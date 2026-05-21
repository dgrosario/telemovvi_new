import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { Channel } from "../../domain/entities/channel";
import { Partner } from "../../domain/entities/partner";
import { PartnerContact } from "../../domain/entities/partner-contact";
import { PhoneNormalizer } from "../../domain/services/phone-normalizer";
import { Metadata } from "../../domain/value-objects/metadata";
import { createDatabaseConnection } from "../database";
import {
  conversations,
  messages,
  partnerContacts,
  partners,
  partnersLabels,
  partnersMetadata,
} from "../database/schemas";

const PartnerContactRowSchema = z.object({
  id: z.string(),
  type: z.enum([
    "whatsapp",
    "instagram",
    "evolution",
    "meta_api",
  ]) as z.ZodType<Channel.Type>,
  value: z.string(),
  username: z.string().nullable(),
  thumbnail: z.string().nullable(),
  channel_id: z.string().nullable(),
  created_at: z.string().nullable(),
});

const MetadataRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const PartnerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_name_custom: z.boolean(),
  birthday: z.string().nullable(),
  contacts: z.array(PartnerContactRowSchema),
  metadata: z.array(MetadataRowSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

const PartnerRowWithWorkspaceSchema = PartnerRowSchema.extend({
  workspace_id: z.string(),
});

const CountRowSchema = z.object({
  total: z.number(),
});

type PartnerRow = z.infer<typeof PartnerRowSchema>;
type PartnerRowWithWorkspace = z.infer<typeof PartnerRowWithWorkspaceSchema>;
type CountRow = z.infer<typeof CountRowSchema>;

export type CanonicalPartnerCandidate = {
  partnerId: string;
  hasNonInstagramContact: boolean;
  contactCount: number;
  labelCount: number;
  metadataCount: number;
  latestConversationActivityAt: Date | null;
  createdAt: Date;
};

export type CanonicalizePartnersResult = {
  canonicalPartner: Partner | null;
  canonicalPartnerId: string | null;
  mergedPartnerIds: string[];
};

export type InstagramDuplicateUsernameGroup = {
  workspaceId: string;
  username: string;
  partnerIds: string[];
};

const PHONE_CONTACT_TYPES = new Set<Channel.Type>([
  "whatsapp",
  "evolution",
  "meta_api",
]);

function isPhoneContactType(type: string): boolean {
  return PHONE_CONTACT_TYPES.has(type as Channel.Type);
}

function normalizeInstagramUsername(value: string): string {
  return value.trim().replace(/^@/, "");
}

function isInstagramScopedId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function getInstagramMergeKey(contact: MergePlanContactInput): string {
  if (contact.type !== "instagram") return "";

  const normalizedUsername = normalizeInstagramUsername(contact.username ?? "");
  if (normalizedUsername) {
    return normalizedUsername.toLowerCase();
  }

  if (isInstagramScopedId(contact.value)) {
    return "";
  }

  return normalizeInstagramUsername(contact.value).toLowerCase();
}

export type MergePlanContactInput = {
  id: string;
  type: Channel.Type;
  value: string;
  username?: string;
};

export type PartnerContactMergePlan = {
  sourceContactIdsToMove: string[];
  sourceContactIdsToDelete: string[];
  targetContactIdsToDelete: string[];
};

export function buildPartnerContactMergePlan(input: {
  targetContacts: MergePlanContactInput[];
  sourceContacts: MergePlanContactInput[];
}): PartnerContactMergePlan {
  const targetContactIdsToDelete = new Set<string>();
  const sourceContactIdsToDelete = new Set<string>();
  const sourceContactIdsToMove: string[] = [];

  const targetContactsByInstagramKey = new Map<string, MergePlanContactInput[]>();

  for (const contact of input.targetContacts) {
    const key = getInstagramMergeKey(contact);
    if (!key) continue;

    const existing = targetContactsByInstagramKey.get(key) ?? [];
    existing.push(contact);
    targetContactsByInstagramKey.set(key, existing);
  }

  for (const sourceContact of input.sourceContacts) {
    const mergeKey = getInstagramMergeKey(sourceContact);
    const targetMatches = mergeKey
      ? targetContactsByInstagramKey.get(mergeKey) ?? []
      : [];

    let shouldMoveSourceContact = true;

    for (const targetContact of targetMatches) {
      const sourceIsScopedId = isInstagramScopedId(sourceContact.value);
      const targetIsScopedId = isInstagramScopedId(targetContact.value);

      if (sourceIsScopedId && !targetIsScopedId) {
        targetContactIdsToDelete.add(targetContact.id);
        continue;
      }

      if (!sourceIsScopedId && targetIsScopedId) {
        sourceContactIdsToDelete.add(sourceContact.id);
        shouldMoveSourceContact = false;
        break;
      }

      if (sourceIsScopedId && targetIsScopedId) {
        targetContactIdsToDelete.add(targetContact.id);
        continue;
      }

      sourceContactIdsToDelete.add(sourceContact.id);
      shouldMoveSourceContact = false;
      break;
    }

    if (shouldMoveSourceContact && !sourceContactIdsToDelete.has(sourceContact.id)) {
      sourceContactIdsToMove.push(sourceContact.id);
    }
  }

  return {
    sourceContactIdsToMove,
    sourceContactIdsToDelete: Array.from(sourceContactIdsToDelete),
    targetContactIdsToDelete: Array.from(targetContactIdsToDelete),
  };
}

function compareCanonicalPartnerCandidates(
  left: CanonicalPartnerCandidate,
  right: CanonicalPartnerCandidate,
): number {
  if (left.hasNonInstagramContact !== right.hasNonInstagramContact) {
    return Number(right.hasNonInstagramContact) - Number(left.hasNonInstagramContact);
  }

  if (left.contactCount !== right.contactCount) {
    return right.contactCount - left.contactCount;
  }

  if (left.labelCount !== right.labelCount) {
    return right.labelCount - left.labelCount;
  }

  if (left.metadataCount !== right.metadataCount) {
    return right.metadataCount - left.metadataCount;
  }

  const leftLatestActivity = left.latestConversationActivityAt?.getTime() ?? 0;
  const rightLatestActivity = right.latestConversationActivityAt?.getTime() ?? 0;
  if (leftLatestActivity !== rightLatestActivity) {
    return rightLatestActivity - leftLatestActivity;
  }

  const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return left.partnerId.localeCompare(right.partnerId);
}

export function selectCanonicalPartnerCandidate(
  candidates: CanonicalPartnerCandidate[],
): CanonicalPartnerCandidate | null {
  if (candidates.length === 0) return null;

  return [...candidates].sort(compareCanonicalPartnerCandidates)[0] ?? null;
}

function buildVariantsByType(type: string, value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (isPhoneContactType(type)) {
    const normalized = PhoneNormalizer.normalize(trimmed);
    return PhoneNormalizer.getVariants(normalized);
  }

  if (type === "instagram") {
    const normalizedUsername = normalizeInstagramUsername(trimmed);
    return normalizedUsername ? [normalizedUsername] : [];
  }

  return [trimmed];
}

function buildVariantsWithoutType(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([
    trimmed,
    normalizeInstagramUsername(trimmed),
  ]);

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 7) {
    for (const variant of PhoneNormalizer.getVariants(digits)) {
      variants.add(variant);
    }
  }

  variants.delete("");
  return Array.from(variants);
}

function parsePartnerRow(row: unknown): PartnerRow {
  return PartnerRowSchema.parse(row);
}

function parsePartnerRowWithWorkspace(row: unknown): PartnerRowWithWorkspace {
  return PartnerRowWithWorkspaceSchema.parse(row);
}

function parseCountRow(row: unknown): CountRow {
  return CountRowSchema.parse(row);
}

function parsePartnerRows(rows: unknown[]): PartnerRow[] {
  return z.array(PartnerRowSchema).parse(rows);
}

function mapRowToPartner(row: PartnerRow): Partner {
  return Partner.instance({
    id: row.id,
    name: row.name,
    isNameCustom: row.is_name_custom,
    birthday: row.birthday ? new Date(row.birthday) : null,
    contacts: row.contacts.map((c) =>
      PartnerContact.instance({
        id: c.id,
        type: c.type,
        value: c.value,
        username: c.username ?? "",
        thumbnail: c.thumbnail ?? "",
        channelId: c.channel_id,
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
      }),
    ),
    metadata: row.metadata.map((m) => Metadata.create(m.label, m.value)),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function mapRowToPartnerRaw(row: PartnerRow): Partner.Raw {
  return {
    id: row.id,
    name: row.name,
    isNameCustom: row.is_name_custom,
    birthday: row.birthday,
    contacts: row.contacts.map((c) => ({
      id: c.id,
      type: c.type,
      value: c.value,
      username: c.username ?? "",
      thumbnail: c.thumbnail ?? "",
      channelId: c.channel_id,
      createdAt: c.created_at ?? new Date().toISOString(),
    })),
    metadata: row.metadata.map((m) => ({
      label: m.label,
      value: m.value,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListInputDTO = {
  workspaceId: string;
  pageIndex: number;
  channelFilters?: (string | null)[];
  query?: string;
};

export type ListOutputDTO = {
  results: Partner.Raw[];
  totalPages: number;
  pageIndex: number;
};

export class PartnersDatabaseRepository {
  async upsert(partner: Partner, workspaceId: string) {
    const db = createDatabaseConnection();

    // Converte Date para string no formato ISO (YYYY-MM-DD) para o campo date do banco
    const birthdayString = partner.birthday
      ? partner.birthday.toISOString().split("T")[0]
      : null;

    await db
      .insert(partners)
      .values({
        id: partner.id,
        name: partner.name,
        isNameCustom: partner.isNameCustom,
        birthday: birthdayString,
        workspaceId,
      })
      .onConflictDoUpdate({
        set: {
          name: partner.name,
          isNameCustom: partner.isNameCustom,
          birthday: birthdayString,
        },
        target: partners.id,
      });

    // Filter valid metadata (non-empty label and value)
    const validMetadata = partner.metadata.filter(
      (m) => m.label && m.label.trim() && m.value && m.value.trim(),
    );
    const currentPairs = validMetadata.map((m) => `${m.label}::${m.value}`);

    const existingMetadata = await db
      .select({
        label: partnersMetadata.label,
        value: partnersMetadata.value,
      })
      .from(partnersMetadata)
      .where(eq(partnersMetadata.partnerId, partner.id));

    const toDeleteMetadata = existingMetadata.filter(
      (m) => !currentPairs.includes(`${m.label}::${m.value}`),
    );

    if (toDeleteMetadata.length > 0) {
      await db.delete(partnersMetadata).where(
        and(
          eq(partnersMetadata.partnerId, partner.id),
          inArray(
            partnersMetadata.label,
            toDeleteMetadata.map((m) => m.label),
          ),
          inArray(
            partnersMetadata.value,
            toDeleteMetadata.map((m) => m.value),
          ),
        ),
      );
    }

    if (validMetadata.length > 0) {
      const metadataValues = validMetadata.map((m) => ({
        partnerId: partner.id,
        label: m.label,
        value: m.value,
      }));

      await db
        .insert(partnersMetadata)
        .values(metadataValues)
        .onConflictDoUpdate({
          target: [partnersMetadata.partnerId, partnersMetadata.label],
          set: {
            value: sql`excluded.value`,
          },
        });
    }

    const currentContactIds = partner.contacts.map((c) => c.id);

    const existingContacts = await db
      .select({
        id: partnerContacts.id,
      })
      .from(partnerContacts)
      .where(eq(partnerContacts.partnerId, partner.id));

    const toDeleteContacts = existingContacts
      .map((c) => c.id)
      .filter((id) => !currentContactIds.includes(id));

    if (toDeleteContacts.length > 0) {
      await db
        .delete(partnerContacts)
        .where(inArray(partnerContacts.id, toDeleteContacts));
    }

    if (partner.contacts.length > 0) {
      const contactValues = partner.contacts.map((c) => ({
        id: c.id,
        partnerId: partner.id,
        thumbnail: c.thumbnail,
        type: c.type,
        value: c.value,
        username: c.username,
        channelId: c.channelId || null,
        createdAt: c.createdAt,
      }));

      await db
        .insert(partnerContacts)
        .values(contactValues)
        .onConflictDoUpdate({
          target: [partnerContacts.partnerId, partnerContacts.value],
          set: {
            type: sql`excluded.type`,
            username: sql`excluded.username`,
            thumbnail: sql`excluded.thumbnail`,
            channelId: sql`COALESCE(excluded.channel_id, ${partnerContacts.channelId})`,
          },
        });
    }
  }

  async createPartnerWithContactAtomic(
    partnerData: { name: string },
    contactData: {
      type: Channel.Type;
      value: string;
      thumbnail?: string;
      channelId?: string | null;
      username?: string;
    },
    workspaceId: string,
  ): Promise<{ partner: Partner; isNew: boolean }> {
    const db = createDatabaseConnection();

    const variants = buildVariantsByType(contactData.type, contactData.value);
    const lookupValues =
      variants.length > 0 ? variants : [contactData.value.trim()];
    const normalizedValue = lookupValues[0] ?? contactData.value.trim();

    console.log(
      "[PartnersRepo.createPartnerWithContactAtomic] Input:",
      "type:",
      contactData.type,
      "value:",
      contactData.value,
      "normalizedValue:",
      normalizedValue,
      "variants:",
      lookupValues,
      "name:",
      partnerData.name,
    );

    return await db.transaction(async (tx) => {
      const [existingContact] = await tx.execute(sql`
        SELECT
          pc.id,
          pc.partner_id,
          p.workspace_id
        FROM ${partnerContacts} pc
        INNER JOIN ${partners} p ON p.id = pc.partner_id
        WHERE pc.type = ${contactData.type}
          AND pc.value = ANY(${sql`ARRAY[${sql.join(
            lookupValues.map((v) => sql`${v}`),
            sql.raw(", "),
          )}]::text[]`})
          AND p.workspace_id = ${workspaceId}
        FOR UPDATE
        LIMIT 1;
      `);

      if (existingContact) {
        const existingRow = existingContact as { partner_id: string };

        console.log(
          "[PartnersRepo.createPartnerWithContactAtomic] Found existing partner:",
          existingRow.partner_id,
          "- will update name to:",
          partnerData.name,
        );

        // UPDATE: Se nome novo é diferente do existente, atualizar
        // Evita sobrescrever nome útil com valores numéricos/telefones.
        const normalizedIncomingName = partnerData.name.trim();
        const incomingNameHasLetters = /\p{L}/u.test(normalizedIncomingName);

        if (normalizedIncomingName) {
          const updateResult = await tx.execute(sql`
            UPDATE ${partners}
            SET name = ${normalizedIncomingName}, updated_at = NOW()
            WHERE id = ${existingRow.partner_id}
              AND name != ${normalizedIncomingName}
              AND is_name_custom = false
              -- SAFETY: static regex literal, do not replace by dynamic user input.
              AND (${incomingNameHasLetters} = true OR name ~ '^[0-9]+$')
            RETURNING id, name
          `);

          if (updateResult.length > 0) {
            console.log(
              "[PartnersRepo.createPartnerWithContactAtomic] ✅ Name updated successfully to:",
              partnerData.name,
            );
          } else {
            console.log(
              "[PartnersRepo.createPartnerWithContactAtomic] ⚠️ Name not updated (already same or no match)",
            );
          }
        }

        const [row] = await tx.execute(sql`
          SELECT
            p.id,
            p.name,
            p.is_name_custom,
            p.birthday,
            p.created_at,
            p.updated_at,
            COALESCE(
              JSON_AGG(
                DISTINCT JSONB_BUILD_OBJECT(
                  'id', pc.id,
                  'type', pc.type,
                  'value', pc.value,
                  'username', pc.username,
                  'thumbnail', pc.thumbnail,
                  'channel_id', pc.channel_id,
                  'created_at', pc.created_at
                )
              ) FILTER (WHERE pc.id IS NOT NULL),
              '[]'
            ) AS contacts,
            COALESCE(
              JSON_AGG(
                DISTINCT JSONB_BUILD_OBJECT(
                  'label', pm.label,
                  'value', pm.value
                )
              ) FILTER (WHERE pm.label IS NOT NULL),
              '[]'
            ) AS metadata
          FROM ${partners} p
          LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
          LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
          WHERE p.id = ${existingRow.partner_id}
          GROUP BY p.id;
        `);

        const parsedRow = parsePartnerRow(row);
        return { partner: mapRowToPartner(parsedRow), isNew: false };
      }

      const now = new Date();
      const partnerId = crypto.randomUUID().toString();
      const contactId = crypto.randomUUID().toString();

      await tx.insert(partners).values({
        id: partnerId,
        name: partnerData.name,
        workspaceId,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(partnerContacts).values({
        id: contactId,
        partnerId,
        type: contactData.type,
        value: normalizedValue,
        username: contactData.username ?? "",
        thumbnail: contactData.thumbnail ?? "",
        channelId: contactData.channelId ?? null,
        createdAt: now,
      });

      const partner = Partner.instance({
        id: partnerId,
        name: partnerData.name,
        isNameCustom: false,
        birthday: null,
        contacts: [
          PartnerContact.instance({
            id: contactId,
            type: contactData.type,
            value: normalizedValue,
            username: contactData.username ?? "",
            thumbnail: contactData.thumbnail ?? "",
            channelId: contactData.channelId ?? null,
            createdAt: now,
          }),
        ],
        metadata: [],
        createdAt: now,
        updatedAt: now,
      });

      return { partner, isNew: true };
    });
  }

  async retrieveByContactValue(
    value: string,
    workspaceId: string,
  ): Promise<Partner | null> {
    if (!value || !workspaceId) return null;
    const db = createDatabaseConnection();

    const variants = PhoneNormalizer.getVariants(value);

    const [row] = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE pc.value = ANY(${sql`ARRAY[${sql.join(
        variants.map((v) => sql`${v}`),
        sql.raw(", "),
      )}]::text[]`}) AND p.workspace_id = ${workspaceId}
      GROUP BY p.id;
    `);

    if (!row) return null;

    const parsedRow = parsePartnerRow(row);
    return mapRowToPartner(parsedRow);
  }

  async retrieveByContactTypeAndValue(
    type: string,
    value: string,
    workspaceId: string,
  ): Promise<Partner | null> {
    if (!workspaceId) return null;
    const db = createDatabaseConnection();

    const variants = buildVariantsByType(type, value);
    if (variants.length === 0) return null;

    const [row] = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE pc.type = ${type} AND pc.value = ANY(${sql`ARRAY[${sql.join(
        variants.map((v) => sql`${v}`),
        sql.raw(", "),
      )}]::text[]`}) AND p.workspace_id = ${workspaceId}
      GROUP BY p.id;
    `);

    if (!row) return null;

    const parsedRow = parsePartnerRow(row);
    return mapRowToPartner(parsedRow);
  }

  async retrieveByContactTypeAndUsername(
    type: string,
    username: string,
    workspaceId: string,
  ): Promise<Partner | null> {
    const partners = await this.listByContactTypeAndUsername(
      type,
      username,
      workspaceId,
    );
    return partners[0] ?? null;
  }

  async listByContactTypeAndUsername(
    type: string,
    username: string,
    workspaceId: string,
  ): Promise<Partner[]> {
    if (!workspaceId) return [];
    const db = createDatabaseConnection();
    const normalizedUsername = normalizeInstagramUsername(username);
    if (!normalizedUsername) return [];

    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE
        pc.type = ${type}
        AND (
          LOWER(pc.username) = LOWER(${normalizedUsername})
          OR (
            COALESCE(pc.username, '') = ''
            AND LOWER(pc.value) = LOWER(${normalizedUsername})
          )
        )
        AND p.workspace_id = ${workspaceId}
      GROUP BY p.id;
    `);

    if (rows.length === 0) return [];

    const parsedRows = parsePartnerRows(Array.from(rows));
    const partnersList = parsedRows.map((row) => mapRowToPartner(row));
    const canonicalCandidates = await this.listCanonicalPartnerCandidates(
      partnersList.map((partner) => partner.id),
      workspaceId,
    );
    const candidatesByPartnerId = new Map(
      canonicalCandidates.map((candidate) => [candidate.partnerId, candidate]),
    );

    return partnersList.sort((left, right) => {
      const leftCandidate = candidatesByPartnerId.get(left.id);
      const rightCandidate = candidatesByPartnerId.get(right.id);
      if (!leftCandidate || !rightCandidate) {
        return left.id.localeCompare(right.id);
      }
      return compareCanonicalPartnerCandidates(leftCandidate, rightCandidate);
    });
  }

  async listDuplicateInstagramUsernameGroups(
    workspaceId?: string,
  ): Promise<InstagramDuplicateUsernameGroup[]> {
    const db = createDatabaseConnection();

    const workspaceFilter = workspaceId
      ? sql`AND p.workspace_id = ${workspaceId}`
      : sql``;

    const results = await db.execute(sql`
      WITH normalized_instagram_contacts AS (
        SELECT
          p.workspace_id,
          LOWER(
            COALESCE(
              NULLIF(TRIM(pc.username), ''),
              CASE
                WHEN pc.value ~ '^[0-9]+$' THEN NULL
                ELSE NULLIF(TRIM(pc.value), '')
              END
            )
          ) AS normalized_username,
          pc.partner_id
        FROM ${partnerContacts} pc
        INNER JOIN ${partners} p ON p.id = pc.partner_id
        WHERE
          pc.type = 'instagram'
          ${workspaceFilter}
      )
      SELECT
        workspace_id,
        normalized_username,
        ARRAY_AGG(DISTINCT partner_id ORDER BY partner_id) AS partner_ids
      FROM normalized_instagram_contacts
      WHERE normalized_username IS NOT NULL
      GROUP BY workspace_id, normalized_username
      HAVING COUNT(DISTINCT partner_id) > 1
      ORDER BY workspace_id, normalized_username
    `);

    const parsed = z
      .array(
        z.object({
          workspace_id: z.string(),
          normalized_username: z.string(),
          partner_ids: z.array(z.string()),
        }),
      )
      .parse(Array.from(results));

    return parsed.map((row) => ({
      workspaceId: row.workspace_id,
      username: row.normalized_username,
      partnerIds: row.partner_ids,
    }));
  }

  async canonicalizePartners(
    partnerIds: string[],
    workspaceId: string,
    options?: { dryRun?: boolean },
  ): Promise<CanonicalizePartnersResult> {
    const uniquePartnerIds = Array.from(
      new Set(partnerIds.filter((partnerId) => !!partnerId)),
    );

    if (uniquePartnerIds.length === 0 || !workspaceId) {
      return {
        canonicalPartner: null,
        canonicalPartnerId: null,
        mergedPartnerIds: [],
      };
    }

    const canonicalCandidates = await this.listCanonicalPartnerCandidates(
      uniquePartnerIds,
      workspaceId,
    );
    const selectedCandidate =
      selectCanonicalPartnerCandidate(canonicalCandidates);

    if (!selectedCandidate) {
      return {
        canonicalPartner: null,
        canonicalPartnerId: null,
        mergedPartnerIds: [],
      };
    }

    const mergedPartnerIds = canonicalCandidates
      .map((candidate) => candidate.partnerId)
      .filter((partnerId) => partnerId !== selectedCandidate.partnerId);

    if (!options?.dryRun) {
      for (const sourcePartnerId of mergedPartnerIds) {
        await this.mergePartnerIntoTarget(
          selectedCandidate.partnerId,
          sourcePartnerId,
          workspaceId,
        );
      }
    }

    return {
      canonicalPartner: await this.retrieve(selectedCandidate.partnerId),
      canonicalPartnerId: selectedCandidate.partnerId,
      mergedPartnerIds,
    };
  }

  private async listCanonicalPartnerCandidates(
    partnerIds: string[],
    workspaceId: string,
  ): Promise<CanonicalPartnerCandidate[]> {
    const uniquePartnerIds = Array.from(
      new Set(partnerIds.filter((partnerId) => !!partnerId)),
    );

    if (uniquePartnerIds.length === 0 || !workspaceId) {
      return [];
    }

    const db = createDatabaseConnection();
    const results = await db.execute(sql`
      SELECT
        p.id AS partner_id,
        p.created_at,
        EXISTS(
          SELECT 1
          FROM ${partnerContacts} pc_non_instagram
          WHERE
            pc_non_instagram.partner_id = p.id
            AND pc_non_instagram.type != 'instagram'
        ) AS has_non_instagram_contact,
        (
          SELECT COUNT(*)::int
          FROM ${partnerContacts} pc_count
          WHERE pc_count.partner_id = p.id
        ) AS contact_count,
        (
          SELECT COUNT(*)::int
          FROM ${partnersLabels} pl
          WHERE pl.partner_id = p.id
        ) AS label_count,
        (
          SELECT COUNT(*)::int
          FROM ${partnersMetadata} pm
          WHERE pm.partner_id = p.id
        ) AS metadata_count,
        (
          SELECT MAX(
            COALESCE(
              (
                SELECT MAX(m.created_at)
                FROM ${messages} m
                WHERE m.conversation_id = c.id
              ),
              EXTRACT(EPOCH FROM c.opened_at)::bigint
            )
          )::bigint
          FROM ${conversations} c
          INNER JOIN ${partnerContacts} pc_conversation
            ON pc_conversation.id = c.contact
          WHERE
            pc_conversation.partner_id = p.id
            AND c.workspace_id = ${workspaceId}
        ) AS latest_conversation_activity_at
      FROM ${partners} p
      WHERE
        p.id = ANY(${sql`ARRAY[${sql.join(
          uniquePartnerIds.map((partnerId) => sql`${partnerId}`),
          sql.raw(", "),
        )}]::uuid[]`})
        AND p.workspace_id = ${workspaceId}
    `);

    const parsed = z
      .array(
        z.object({
          partner_id: z.string(),
          created_at: z.coerce.date(),
          has_non_instagram_contact: z.boolean(),
          contact_count: z.coerce.number(),
          label_count: z.coerce.number(),
          metadata_count: z.coerce.number(),
          latest_conversation_activity_at: z.coerce.number().nullable(),
        }),
      )
      .parse(Array.from(results));

    return parsed.map((row) => ({
      partnerId: row.partner_id,
      hasNonInstagramContact: row.has_non_instagram_contact,
      contactCount: row.contact_count,
      labelCount: row.label_count,
      metadataCount: row.metadata_count,
      latestConversationActivityAt:
        row.latest_conversation_activity_at === null
          ? null
          : new Date(row.latest_conversation_activity_at * 1000),
      createdAt: row.created_at,
    }));
  }

  async retrieve(id: string): Promise<Partner | null> {
    if (!id) return null;
    const db = createDatabaseConnection();

    const [resolvedPartner] = await db.execute(sql`
      SELECT resolved.id
      FROM (
        SELECT p.id
        FROM ${partners} p
        WHERE p.id = ${id}

        UNION ALL

        SELECT pc.partner_id AS id
        FROM ${partnerContacts} pc
        WHERE pc.id = ${id}
      ) AS resolved
      LIMIT 1;
    `);

    if (!resolvedPartner) return null;

    const partnerId = (resolvedPartner as { id: string }).id;

    const [row] = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE p.id = ${partnerId}
      GROUP BY p.id;
    `);

    if (!row) return null;

    const parsedRow = parsePartnerRow(row);
    return mapRowToPartner(parsedRow);
  }

  async retrieveMany(ids: string[]): Promise<Map<string, { name: string }>> {
    if (ids.length === 0) return new Map();

    const db = createDatabaseConnection();

    const results = await db
      .select({
        id: partners.id,
        name: partners.name,
      })
      .from(partners)
      .where(inArray(partners.id, ids));

    const partnersMap = new Map<string, { name: string }>();
    for (const row of results) {
      partnersMap.set(row.id, {
        name: row.name,
      });
    }

    return partnersMap;
  }

  async search(query: string, workspaceId: string): Promise<Partner.Raw[]> {
    if (!query || !workspaceId) return [];
    const db = createDatabaseConnection();

    const digits = query.replace(/\D/g, "");
    const hasPhoneDigits = digits.length >= 4;
    const normalizedInstagramQuery = normalizeInstagramUsername(query);

    const nameFilter = sql`p.name ILIKE ${`%${query}%`}`;
    const whereFilter = hasPhoneDigits
      ? sql`(
          ${nameFilter}
          OR pc.value = ANY(${sql`ARRAY[${sql.join(
            PhoneNormalizer.getVariants(digits).map((v) => sql`${v}`),
            sql.raw(", "),
          )}]::text[]`})
          OR LOWER(pc.username) LIKE LOWER(${`%${normalizedInstagramQuery}%`})
        )`
      : sql`(${nameFilter} OR LOWER(pc.username) LIKE LOWER(${`%${normalizedInstagramQuery}%`}))`;

    const results = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE ${whereFilter} AND p.workspace_id = ${workspaceId}
      GROUP BY p.id;
    `);

    const parsedRows = parsePartnerRows(results);
    return parsedRows.map(mapRowToPartnerRaw);
  }

  async list(input: ListInputDTO): Promise<ListOutputDTO> {
    console.log("[PartnersRepo.list] Input:", JSON.stringify(input));
    const db = createDatabaseConnection();

    const pageSize = 20;
    const offset = input.pageIndex * pageSize;

    const hasQuery = input.query && input.query.trim().length > 0;
    const queryPattern = hasQuery ? `%${input.query}%` : "";

    const [countRow] = await db.execute(sql`
      SELECT COUNT(DISTINCT p.id)::int AS total
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      WHERE p.workspace_id = ${input.workspaceId}
        ${
          input.channelFilters && input.channelFilters.length > 0
            ? sql`AND pc.type IN (${sql.join(
                input.channelFilters.map((f) => sql`${f}`),
                sql`, `,
              )})`
            : sql``
        }
        ${hasQuery ? sql`AND (p.name ILIKE ${queryPattern} OR pc.value ILIKE ${queryPattern} OR pc.username ILIKE ${queryPattern})` : sql``};
    `);

    console.log("[PartnersRepo.list] countRow:", countRow);
    const parsedCountRow = parseCountRow(countRow);
    const totalCount = parsedCountRow.total;
    const totalPages = Math.ceil(totalCount / pageSize);
    console.log(
      "[PartnersRepo.list] totalCount:",
      totalCount,
      "totalPages:",
      totalPages,
    );

    const result = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      LEFT JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE p.workspace_id = ${input.workspaceId}
        ${
          input.channelFilters && input.channelFilters.length > 0
            ? sql`AND pc.type IN (${sql.join(
                input.channelFilters.map((f) => sql`${f}`),
                sql`, `,
              )})`
            : sql``
        }
        ${hasQuery ? sql`AND (p.name ILIKE ${queryPattern} OR pc.value ILIKE ${queryPattern} OR pc.username ILIKE ${queryPattern})` : sql``}
      GROUP BY p.id
      ORDER BY p.name ASC
      LIMIT ${pageSize} OFFSET ${offset};
    `);

    const parsedResults = parsePartnerRows(result);
    return {
      results: parsedResults.map(mapRowToPartnerRaw),
      totalPages,
      pageIndex: input.pageIndex,
    };
  }

  async remove(ids: string[], workspaceId: string): Promise<void> {
    if (ids.length === 0) return;

    const db = createDatabaseConnection();
    await db
      .delete(partners)
      .where(
        and(inArray(partners.id, ids), eq(partners.workspaceId, workspaceId)),
      );
  }

  async findPartnerByExactContactValue(
    value: string,
    workspaceId: string,
  ): Promise<Partner | null> {
    if (!value || !workspaceId) return null;
    const db = createDatabaseConnection();

    const variants = PhoneNormalizer.getVariants(value);

    const [row] = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE pc.value = ANY(${sql`ARRAY[${sql.join(
        variants.map((v) => sql`${v}`),
        sql.raw(", "),
      )}]::text[]`}) AND p.workspace_id = ${workspaceId}
      GROUP BY p.id
      LIMIT 1;
    `);

    if (!row) return null;

    const parsedRow = parsePartnerRow(row);
    return mapRowToPartner(parsedRow);
  }

  async updatePartnerField(
    partnerId: string,
    field: string,
    value: string,
  ): Promise<void> {
    const db = createDatabaseConnection();

    if (field === "name") {
      await db
        .update(partners)
        .set({ name: value, isNameCustom: true, updatedAt: new Date() })
        .where(eq(partners.id, partnerId));
      return;
    }

    const metadataLabel = field;
    await db
      .insert(partnersMetadata)
      .values({
        partnerId,
        label: metadataLabel,
        value,
      })
      .onConflictDoUpdate({
        target: [partnersMetadata.partnerId, partnersMetadata.label],
        set: { value },
      });
  }

  async updatePartnerFieldByContactId(
    contactId: string,
    field: string,
    value: string,
  ): Promise<void> {
    const db = createDatabaseConnection();

    // First, get the partner ID from the contact
    const contact = await db
      .select({ partnerId: partnerContacts.partnerId })
      .from(partnerContacts)
      .where(eq(partnerContacts.id, contactId))
      .limit(1);

    if (!contact[0]) {
      console.error("[PartnersRepository] Contact not found:", contactId);
      return;
    }

    const partnerId = contact[0].partnerId;

    if (field === "name") {
      await db
        .update(partners)
        .set({ name: value, isNameCustom: true, updatedAt: new Date() })
        .where(eq(partners.id, partnerId));
      return;
    }

    const metadataLabel = field;
    await db
      .insert(partnersMetadata)
      .values({
        partnerId,
        label: metadataLabel,
        value,
      })
      .onConflictDoUpdate({
        target: [partnersMetadata.partnerId, partnersMetadata.label],
        set: { value },
      });
  }

  async deleteOrphan(partnerId: string): Promise<void> {
    const db = createDatabaseConnection();

    const hasContacts = await db
      .select({ id: partnerContacts.id })
      .from(partnerContacts)
      .where(eq(partnerContacts.partnerId, partnerId))
      .limit(1);

    if (hasContacts.length === 0) {
      await db
        .delete(partnersMetadata)
        .where(eq(partnersMetadata.partnerId, partnerId));
      await db.delete(partners).where(eq(partners.id, partnerId));
    }
  }

  async mergePartnerIntoTarget(
    targetPartnerId: string,
    sourcePartnerId: string,
    workspaceId: string,
  ): Promise<Partner | null> {
    if (!targetPartnerId || !sourcePartnerId || targetPartnerId === sourcePartnerId) {
      return this.retrieve(targetPartnerId);
    }

    const db = createDatabaseConnection();

    await db.transaction(async (tx) => {
      const [targetPartnerRow, sourcePartnerRow] = await Promise.all([
        tx
          .select({ id: partners.id })
          .from(partners)
          .where(
            and(
              eq(partners.id, targetPartnerId),
              eq(partners.workspaceId, workspaceId),
            ),
          )
          .limit(1),
        tx
          .select({ id: partners.id })
          .from(partners)
          .where(
            and(
              eq(partners.id, sourcePartnerId),
              eq(partners.workspaceId, workspaceId),
            ),
          )
          .limit(1),
      ]);

      if (!targetPartnerRow || !sourcePartnerRow) {
        return;
      }

      const [targetContacts, sourceContacts, targetMetadataRows, sourceMetadataRows, sourceLabelRows] =
        await Promise.all([
          tx
            .select({
              id: partnerContacts.id,
              type: partnerContacts.type,
              value: partnerContacts.value,
              username: partnerContacts.username,
            })
            .from(partnerContacts)
            .where(eq(partnerContacts.partnerId, targetPartnerId)),
          tx
            .select({
              id: partnerContacts.id,
              type: partnerContacts.type,
              value: partnerContacts.value,
              username: partnerContacts.username,
            })
            .from(partnerContacts)
            .where(eq(partnerContacts.partnerId, sourcePartnerId)),
          tx
            .select({
              label: partnersMetadata.label,
            })
            .from(partnersMetadata)
            .where(eq(partnersMetadata.partnerId, targetPartnerId)),
          tx
            .select({
              label: partnersMetadata.label,
              value: partnersMetadata.value,
            })
            .from(partnersMetadata)
            .where(eq(partnersMetadata.partnerId, sourcePartnerId)),
          tx
            .select({
              labelId: partnersLabels.labelId,
            })
            .from(partnersLabels)
            .where(eq(partnersLabels.partnerId, sourcePartnerId)),
        ]);

      const mergePlan = buildPartnerContactMergePlan({
        targetContacts: targetContacts.map((contact) => ({
          id: contact.id,
          type: contact.type,
          value: contact.value,
          username: contact.username ?? "",
        })),
        sourceContacts: sourceContacts.map((contact) => ({
          id: contact.id,
          type: contact.type,
          value: contact.value,
          username: contact.username ?? "",
        })),
      });

      if (mergePlan.targetContactIdsToDelete.length > 0) {
        await tx
          .delete(partnerContacts)
          .where(
            and(
              eq(partnerContacts.partnerId, targetPartnerId),
              inArray(partnerContacts.id, mergePlan.targetContactIdsToDelete),
            ),
          );
      }

      if (mergePlan.sourceContactIdsToDelete.length > 0) {
        await tx
          .delete(partnerContacts)
          .where(
            and(
              eq(partnerContacts.partnerId, sourcePartnerId),
              inArray(partnerContacts.id, mergePlan.sourceContactIdsToDelete),
            ),
          );
      }

      if (mergePlan.sourceContactIdsToMove.length > 0) {
        await tx
          .update(partnerContacts)
          .set({ partnerId: targetPartnerId })
          .where(
            and(
              eq(partnerContacts.partnerId, sourcePartnerId),
              inArray(partnerContacts.id, mergePlan.sourceContactIdsToMove),
            ),
          );
      }

      if (sourceLabelRows.length > 0) {
        await tx
          .insert(partnersLabels)
          .values(
            sourceLabelRows.map((row) => ({
              partnerId: targetPartnerId,
              labelId: row.labelId,
            })),
          )
          .onConflictDoNothing();
      }

      const targetMetadataLabels = new Set(targetMetadataRows.map((row) => row.label));
      const metadataToCopy = sourceMetadataRows.filter(
        (row) => !targetMetadataLabels.has(row.label),
      );

      if (metadataToCopy.length > 0) {
        await tx
          .insert(partnersMetadata)
          .values(
            metadataToCopy.map((row) => ({
              partnerId: targetPartnerId,
              label: row.label,
              value: row.value,
            })),
          )
          .onConflictDoNothing();
      }
    });

    await this.deleteOrphan(sourcePartnerId);
    return this.retrieve(targetPartnerId);
  }

  async getPartnerEmailByContactId(contactId: string): Promise<string | null> {
    if (!contactId) return null;
    const db = createDatabaseConnection();

    const [row] = await db.execute(sql`
      SELECT pm.value as email
      FROM ${partnerContacts} pc
      INNER JOIN ${partnersMetadata} pm ON pm.partner_id = pc.partner_id
      WHERE pc.id = ${contactId} AND pm.label = 'email'
      LIMIT 1;
    `);

    if (!row) return null;

    const parsed = z.object({ email: z.string() }).safeParse(row);
    return parsed.success ? parsed.data.email : null;
  }

  async retrieveByPartnerContactIdWithWorkspace(
    partnerContactId: string,
  ): Promise<{ partner: Partner; workspaceId: string } | null> {
    if (!partnerContactId) return null;
    const db = createDatabaseConnection();

    const [row] = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.is_name_custom,
        p.birthday,
        p.workspace_id,
        p.created_at,
        p.updated_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', pc.id,
              'type', pc.type,
              'value', pc.value,
              'username', pc.username,
              'thumbnail', pc.thumbnail,
              'channel_id', pc.channel_id,
              'created_at', pc.created_at
            )
          ) FILTER (WHERE pc.id IS NOT NULL),
          '[]'
        ) AS contacts,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'label', pm.label,
              'value', pm.value
            )
          ) FILTER (WHERE pm.label IS NOT NULL),
          '[]'
        ) AS metadata
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      LEFT JOIN ${partnersMetadata} pm ON pm.partner_id = p.id
      WHERE pc.id = ${partnerContactId}
      GROUP BY p.id;
    `);

    if (!row) return null;

    const parsedRow = parsePartnerRowWithWorkspace(row);
    const partner = mapRowToPartner(parsedRow);

    return {
      partner,
      workspaceId: parsedRow.workspace_id,
    };
  }

  async findByLabelsWithWhatsAppContacts(
    workspaceId: string,
    labelIds: string[],
  ): Promise<
    Array<{ partnerId: string; partnerContactId: string; contactValue: string }>
  > {
    if (!workspaceId || labelIds.length === 0) return [];

    const db = createDatabaseConnection();

    const results = await db.execute(sql`
      SELECT DISTINCT
        p.id as partner_id,
        pc.id as partner_contact_id,
        pc.value as contact_value
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      INNER JOIN ${partnersLabels} pl ON pl.partner_id = p.id
      WHERE p.workspace_id = ${workspaceId}
        AND pc.type IN ('whatsapp', 'evolution', 'meta_api')
        AND pl.label_id = ANY(${labelIds}::uuid[])
      ORDER BY p.id, pc.id
    `);

    const parsed = z
      .array(
        z.object({
          partner_id: z.string(),
          partner_contact_id: z.string(),
          contact_value: z.string(),
        }),
      )
      .safeParse(results);

    if (!parsed.success) return [];

    return parsed.data.map((row) => ({
      partnerId: row.partner_id,
      partnerContactId: row.partner_contact_id,
      contactValue: row.contact_value,
    }));
  }

  async countByLabels(
    workspaceId: string,
    labelIds: string[],
  ): Promise<number> {
    if (!workspaceId || labelIds.length === 0) return 0;

    const db = createDatabaseConnection();

    const [result] = await db.execute(sql`
      SELECT COUNT(DISTINCT pc.id) as count
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      INNER JOIN ${partnersLabels} pl ON pl.partner_id = p.id
      WHERE p.workspace_id = ${workspaceId}
        AND pc.type IN ('whatsapp', 'evolution', 'meta_api')
        AND pl.label_id = ANY(${labelIds}::uuid[])
    `);

    const parsed = z.object({ count: z.coerce.number() }).safeParse(result);
    return parsed.success ? parsed.data.count : 0;
  }

  async findBirthdayPartnersWithWhatsAppContacts(
    workspaceId: string,
  ): Promise<Array<{ partnerId: string; partnerContactId: string }>> {
    if (!workspaceId) return [];

    const db = createDatabaseConnection();
    const whatsappTypes: Channel.Type[] = ["whatsapp", "evolution", "meta_api"];

    const results = await db
      .select({
        partnerId: partners.id,
        partnerContactId: partnerContacts.id,
      })
      .from(partners)
      .innerJoin(partnerContacts, eq(partnerContacts.partnerId, partners.id))
      .where(
        and(
          eq(partners.workspaceId, workspaceId),
          inArray(partnerContacts.type, whatsappTypes),
          sql`EXTRACT(MONTH FROM ${partners.birthday}) = EXTRACT(MONTH FROM CURRENT_DATE)`,
          sql`EXTRACT(DAY FROM ${partners.birthday}) = EXTRACT(DAY FROM CURRENT_DATE)`,
        ),
      );

    return results;
  }

  async updateContactThumbnail(
    contactId: string,
    thumbnail: string,
  ): Promise<void> {
    if (!contactId) return;

    const db = createDatabaseConnection();

    await db
      .update(partnerContacts)
      .set({ thumbnail })
      .where(eq(partnerContacts.id, contactId));
  }

  async findNamesByContactValues(
    values: string[],
    workspaceId: string,
  ): Promise<Map<string, string>> {
    if (values.length === 0 || !workspaceId) return new Map();

    const db = createDatabaseConnection();

    // Generate all variants for each value
    const allVariants: string[] = [];
    const valueToVariants = new Map<string, string[]>();

    for (const value of values) {
      const variants = buildVariantsWithoutType(value);
      if (variants.length === 0) continue;
      valueToVariants.set(value, variants);
      allVariants.push(...variants);
    }

    if (allVariants.length === 0) return new Map();

    const results = await db.execute(sql`
      SELECT pc.value, p.name
      FROM ${partners} p
      INNER JOIN ${partnerContacts} pc ON pc.partner_id = p.id
      WHERE pc.value = ANY(${sql`ARRAY[${sql.join(
        allVariants.map((v) => sql`${v}`),
        sql.raw(", "),
      )}]::text[]`})
        AND p.workspace_id = ${workspaceId}
    `);

    const parsed = z
      .array(
        z.object({
          value: z.string(),
          name: z.string(),
        }),
      )
      .safeParse(results);

    if (!parsed.success) return new Map();

    // Map found values back to original values
    const resultMap = new Map<string, string>();
    for (const row of parsed.data) {
      // Find which original value this result belongs to
      for (const [originalValue, variants] of valueToVariants.entries()) {
        if (variants.includes(row.value)) {
          resultMap.set(originalValue, row.name);
          break;
        }
      }
    }

    return resultMap;
  }

  async findExistingContactValues(
    values: string[],
    workspaceId: string,
  ): Promise<string[]> {
    if (values.length === 0 || !workspaceId) return [];

    const db = createDatabaseConnection();

    const allVariants: string[] = [];
    const valueToVariants = new Map<string, string[]>();

    for (const value of values) {
      const variants = buildVariantsWithoutType(value);
      if (variants.length === 0) continue;
      valueToVariants.set(value, variants);
      allVariants.push(...variants);
    }

    if (allVariants.length === 0) return [];

    const results = await db.execute(sql`
      SELECT DISTINCT pc.value
      FROM ${partnerContacts} pc
      INNER JOIN ${partners} p ON p.id = pc.partner_id
      WHERE pc.value = ANY(${sql`ARRAY[${sql.join(
        allVariants.map((v) => sql`${v}`),
        sql.raw(", "),
      )}]::text[]`})
        AND p.workspace_id = ${workspaceId}
    `);

    const parsed = z.array(z.object({ value: z.string() })).safeParse(results);
    if (!parsed.success) return [];

    const foundValues = new Set(parsed.data.map((r) => r.value));
    const existingOriginalValues: string[] = [];

    for (const [originalValue, variants] of valueToVariants.entries()) {
      if (variants.some((v) => foundValues.has(v))) {
        existingOriginalValues.push(originalValue);
      }
    }

    return existingOriginalValues;
  }

  async addContactIfNotExists(
    partnerId: string,
    contactData: { type: Channel.Type; value: string; channelId?: string },
  ): Promise<void> {
    const db = createDatabaseConnection();

    await db
      .insert(partnerContacts)
      .values({
        id: crypto.randomUUID(),
        partnerId,
        type: contactData.type,
        value: contactData.value,
        username: "",
        thumbnail: "",
        channelId: contactData.channelId ?? null,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  static instance() {
    return new PartnersDatabaseRepository();
  }
}
