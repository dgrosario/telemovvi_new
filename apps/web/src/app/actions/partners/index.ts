"use server";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnersDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-repository";
import { PartnersLabelsDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-labels-repository";
import { SectorPermissionsDatabaseRepository } from "@omnichannel/core/infra/repositories/sector-permissions-repository";
import { ListPartners } from "@omnichannel/core/application/command/list-partners";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import {
  listPartnersInputSchema,
  removePartnersInputSchema,
  retrievePartnerInputSchema,
  searchPartnerInputSchema,
  upsertPartnersInputSchema,
} from "./schema";
import {
  buildInstagramCanonicalizationRequests,
  buildUpsertContactsAfterMerge,
  mergeLabelIdsAfterPartnerMerge,
  mergeMetadataAfterPartnerMerge,
} from "./merge-on-save";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import { Metadata } from "@omnichannel/core/domain/value-objects/metadata";

const partnersRepository = PartnersDatabaseRepository.instance();
const partnersLabelsRepository = PartnersLabelsDatabaseRepository.instance();
const sectorPermissionsRepository =
  SectorPermissionsDatabaseRepository.instance();

function normalizeInstagramUsername(value: string): string {
  return value.trim().replace(/^@/, "");
}

function isInstagramScopedId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export const listPartners = securityProcedure(["list:partners"])
  .input(listPartnersInputSchema)
  .handler(async ({ ctx, input }) => {
    const listPartnersCommand = ListPartners.instance();
    return await listPartnersCommand.execute({
      id: ctx.user.id,
      workspaceId: ctx.membership.workspaceId,
      membership: ctx.membership,
      pageIndex: input.pageIndex,
      channelFilters: input.channelFilters,
      query: input.query,
    });
  });

export const retrievePartner = securityProcedure(["list:partners"])
  .input(retrievePartnerInputSchema)
  .handler(async ({ ctx, input }) => {
    const partner = await partnersRepository.retrieve(input.id);
    if (!partner) return null;

    const raw = partner.raw();

    if (input.sectorId) {
      const hasViewContactDetailsPermission =
        ctx.membership.permissions.includes("view:contact-details");

      if (!hasViewContactDetailsPermission) {
        return {
          ...raw,
          contacts: raw.contacts.map((c) => ({
            ...c,
            value: "***",
            username: "***",
          })),
        };
      }

      const blockedSectors =
        await sectorPermissionsRepository.listBlockedSectorsForContactDetails(
          ctx.user.id,
        );
      const blockedSectorIds = blockedSectors.map((s) => s.sectorId);

      if (blockedSectorIds.includes(input.sectorId)) {
        return {
          ...raw,
          contacts: raw.contacts.map((c) => ({
            ...c,
            value: "***",
            username: "***",
          })),
        };
      }
    }

    return raw;
  });

export const searchPartners = securityProcedure(["list:partners"])
  .input(searchPartnerInputSchema)
  .handler(async ({ input, ctx }) => {
    return await partnersRepository.search(
      input.query,
      ctx.membership.workspaceId,
    );
  });

export const upsertPartner = securityProcedure(["register:partners"])
  .input(upsertPartnersInputSchema)
  .handler(async ({ ctx, input }) => {
    let finalLabelIds = input.labelIds ?? [];
    let partner = await partnersRepository.retrieve(input.id ?? "");
    if (!partner) {
      const normalizedInstagramUsernames = Array.from(
        new Set(
          input.contacts
            .filter((contact) => contact.type === "instagram")
            .map((contact) => normalizeInstagramUsername(contact.value))
            .filter(
              (username) => !!username && !isInstagramScopedId(username),
            )
            .map((username) => username.toLowerCase()),
        ),
      );

      for (const username of normalizedInstagramUsernames) {
        const matchingPartners =
          await partnersRepository.listByContactTypeAndUsername(
            "instagram",
            username,
            ctx.membership.workspaceId,
          );

        if (matchingPartners.length > 0) {
          throw new Error(
            `O Instagram @${username} já está cadastrado no sistema. ` +
              `Busque o contato existente em vez de criar um novo.`,
          );
        }
      }

      const contactValues = input.contacts.map((c) =>
        c.type === "instagram" ? normalizeInstagramUsername(c.value) : c.value,
      );
      const existingValues = await partnersRepository.findExistingContactValues(
        contactValues,
        ctx.membership.workspaceId,
      );

      if (existingValues.length > 0) {
        throw new Error(
          `O contato ${existingValues[0]} já está cadastrado no sistema. ` +
            `Busque o contato existente em vez de criar um novo.`,
        );
      }

      // Filter out metadata with empty labels or values
      const validMetadata = input.metadata.filter(
        (m) => m.label && m.label.trim() && m.value && m.value.trim(),
      );
      partner = Partner.create({
        name: input.name,
        birthday: input.birthday ? new Date(input.birthday) : null,
        contacts: input.contacts.map((c) => ({
          ...(c.type === "instagram"
            ? (() => {
                const normalizedInstagramValue = normalizeInstagramUsername(
                  c.value,
                );
                const isId = isInstagramScopedId(normalizedInstagramValue);
                return {
                  value: normalizedInstagramValue,
                  username: isId ? "" : normalizedInstagramValue,
                };
              })()
            : { value: c.value }),
          id: c.id,
          type: c.type,
          channelId: c.channelId,
          createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
        })),
        metadata: validMetadata,
      });
      // Nome informado manualmente no cadastro deve ser preservado
      partner.setCustomName(input.name);
    } else {
      const existingPartner = partner;
      const originalPartnerRaw = existingPartner.raw();
      const originalLabelIds = (
        await partnersLabelsRepository.listLabelsByPartner(
          existingPartner.id,
          ctx.membership.workspaceId,
        )
      ).map((label) => label.id);

      if (input.contacts?.length) {
        const matchedPartnerIdsByUsername: Record<string, string[]> = {};
        const normalizedInstagramUsernames = Array.from(
          new Set(
            input.contacts
              .filter((contact) => contact.type === "instagram")
              .map((contact) => normalizeInstagramUsername(contact.value))
              .filter(
                (username) => !!username && !isInstagramScopedId(username),
              )
              .map((username) => username.toLowerCase()),
          ),
        );

        for (const username of normalizedInstagramUsernames) {
          const matchingPartners =
            await partnersRepository.listByContactTypeAndUsername(
              "instagram",
              username,
              ctx.membership.workspaceId,
            );

          matchedPartnerIdsByUsername[username] = matchingPartners.map(
            (candidate) => candidate.id,
          );
        }

        for (const username of normalizedInstagramUsernames) {
          const [request] = buildInstagramCanonicalizationRequests({
            currentPartnerId: partner.id,
            inputContacts: input.contacts.filter(
              (contact) =>
                contact.type === "instagram" &&
                normalizeInstagramUsername(contact.value).toLowerCase() ===
                  username,
            ),
            matchedPartnerIdsByUsername,
          });

          if (!request) continue;

          const canonicalization = await partnersRepository.canonicalizePartners(
            request.candidatePartnerIds,
            ctx.membership.workspaceId,
          );

          if (canonicalization.canonicalPartner) {
            partner = canonicalization.canonicalPartner;
          }
        }

        const refreshedPartner =
          (await partnersRepository.retrieve(partner.id)) ?? partner;
        partner = refreshedPartner;
      }

      if (input.name) {
        partner.setCustomName(input.name);
      }
      if (input.birthday !== undefined) {
        partner.setBirthday(input.birthday ? new Date(input.birthday) : null);
      }
      if (input.contacts) {
        const refreshedPartner = partner;
        const finalContacts = buildUpsertContactsAfterMerge({
          originalContacts: originalPartnerRaw.contacts.map((contact) => ({
            id: contact.id,
            type: contact.type,
            value: contact.value,
            channelId: contact.channelId ?? null,
            createdAt: contact.createdAt,
          })),
          refreshedContacts: refreshedPartner.raw().contacts,
          inputContacts: input.contacts,
        });

        refreshedPartner.setContacts(
          finalContacts.map((contact) => {
            const existingContact = refreshedPartner.retrieveContact(contact.id);
            const isInstagram = contact.type === "instagram";
            const normalizedInstagramValue = isInstagram
              ? normalizeInstagramUsername(contact.value)
              : contact.value;
            const isInstagramId =
              isInstagram && isInstagramScopedId(normalizedInstagramValue);
            const existingInstagramIsId =
              existingContact?.type === "instagram" &&
              isInstagramScopedId(existingContact.value);

            const nextInstagramValue =
              isInstagram && !isInstagramId && existingInstagramIsId
                ? existingContact!.value
                : normalizedInstagramValue;
            const nextInstagramUsername = isInstagram
              ? isInstagramId
                ? contact.username || existingContact?.username || ""
                : contact.username || normalizedInstagramValue
              : contact.username || existingContact?.username || "";

            return PartnerContact.instance({
              id: contact.id,
              thumbnail: contact.thumbnail || existingContact?.thumbnail || "",
              type: contact.type,
              value: isInstagram ? nextInstagramValue : contact.value,
              username: nextInstagramUsername,
              channelId: contact.channelId ?? existingContact?.channelId ?? null,
              createdAt: contact.createdAt
                ? new Date(contact.createdAt)
                : new Date(),
            });
          }),
        );
      }
      if (input.metadata) {
        // Filter out metadata with empty labels or values
        const validMetadata = input.metadata.filter(
          (m) => m.label && m.label.trim() && m.value && m.value.trim(),
        );
        const finalMetadata = mergeMetadataAfterPartnerMerge({
          originalMetadata: originalPartnerRaw.metadata,
          refreshedMetadata: partner.raw().metadata,
          inputMetadata: validMetadata,
        });
        partner.setMetadata(
          finalMetadata.map((m) => Metadata.create(m.label, m.value)),
        );
      }

      const currentLabelIds = (
        await partnersLabelsRepository.listLabelsByPartner(
          partner.id,
          ctx.membership.workspaceId,
        )
      ).map((label) => label.id);
      finalLabelIds = mergeLabelIdsAfterPartnerMerge({
        originalLabelIds,
        currentLabelIds,
        inputLabelIds: finalLabelIds,
      });
    }
    await partnersRepository.upsert(partner, ctx.membership.workspaceId);

    if (finalLabelIds.length > 0) {
      await partnersLabelsRepository.setPartnerLabels(
        partner.id,
        finalLabelIds,
        ctx.membership.workspaceId,
      );
    } else {
      await partnersLabelsRepository.removeAllLabelsFromPartner(
        partner.id,
        ctx.membership.workspaceId,
      );
    }

    revalidatePath("/clients", "page");
    return partner.raw();
  });

export const removePartners = securityProcedure(["remove:partners"])
  .input(removePartnersInputSchema)
  .handler(async ({ ctx, input }) => {
    await partnersRepository.remove(input.ids, ctx.membership.workspaceId);
    revalidatePath("/clients", "page");
  });

export const getPartnerLabels = securityProcedure(["list:partners"])
  .input(retrievePartnerInputSchema)
  .handler(async ({ ctx, input }) => {
    return await partnersLabelsRepository.listLabelsByPartner(
      input.id,
      ctx.membership.workspaceId,
    );
  });
