"use server";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnersDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-repository";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import { Metadata } from "@omnichannel/core/domain/value-objects/metadata";
import { revalidatePath } from "next/cache";
import { securityProcedure } from "../procedure";
import z from "zod";

const partnersRepository = PartnersDatabaseRepository.instance();

// Schema para importação de contatos
const importContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  tags: z.string().optional(), // Tags separadas por vírgula
  data_nascimento: z.string().optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  // Campos de variáveis customizadas (var1, var2, etc.)
}).passthrough();

const importContactsInputSchema = z.object({
  contacts: z.array(importContactSchema),
});

// Exportar contatos para CSV
export const exportContacts = securityProcedure(["manage:partners"])
  .handler(async ({ ctx }) => {
    const result = await partnersRepository.list({
      workspaceId: ctx.membership.workspaceId,
      pageIndex: 0,
      channelFilters: [],
      query: "",
    });

    // Buscar todos os contatos (sem paginação)
    const allPartners: Partner.Raw[] = [];
    let pageIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await partnersRepository.list({
        workspaceId: ctx.membership.workspaceId,
        pageIndex,
        channelFilters: [],
        query: "",
      });
      allPartners.push(...page.results);
      hasMore = pageIndex < page.totalPages - 1;
      pageIndex++;
    }

    // Campos fixos que não devem aparecer como metadata extra
    const fixedMetadataFields = ["cep", "endereco", "email"];

    // Coletar todas as labels de metadata únicas (exceto campos fixos)
    const allMetadataLabels = new Set<string>();
    for (const partner of allPartners) {
      for (const meta of partner.metadata) {
        if (!fixedMetadataFields.includes(meta.label)) {
          allMetadataLabels.add(meta.label);
        }
      }
    }

    // Ordenar labels alfabeticamente
    const metadataLabels = Array.from(allMetadataLabels).sort();

    // Criar cabeçalho do CSV com campos fixos + metadata dinâmica
    const headers = ["nome", "telefone", "data_nascimento", "cep", "endereco", "tags", ...metadataLabels];

    // Criar linhas do CSV
    const rows = allPartners.map((partner) => {
      const phone = partner.contacts.find(
        (c) => c.type === "whatsapp" || c.type === "evolution" || c.type === "meta_api"
      )?.value || "";

      // Tags foram substituídas por labels - deixar vazio no export
      const tags = "";

      // Extrair campos fixos de metadata
      const cep = partner.metadata.find((m) => m.label === "cep")?.value || "";
      const endereco = partner.metadata.find((m) => m.label === "endereco")?.value || "";

      // Criar objeto com valores de metadata (exceto campos fixos)
      const metadataValues: Record<string, string> = {};
      for (const meta of partner.metadata) {
        if (!fixedMetadataFields.includes(meta.label)) {
          metadataValues[meta.label] = meta.value;
        }
      }

      // Criar linha com valores na ordem correta
      const row = [
        partner.name,
        phone,
        partner.birthday || "",
        cep,
        endereco,
        tags,
        ...metadataLabels.map((label) => metadataValues[label] || ""),
      ];

      return row;
    });

    return {
      headers,
      rows,
      totalContacts: allPartners.length,
    };
  });

// Importar contatos de CSV
export const importContacts = securityProcedure(["manage:partners"])
  .input(importContactsInputSchema)
  .handler(async ({ ctx, input }) => {
    const results = {
      imported: 0,
      updated: 0,
      errors: [] as { row: number; error: string }[],
    };

    // Campos fixos que não devem ser tratados como metadata dinâmica
    const fixedFields = ["name", "phone", "email", "tags", "data_nascimento", "cep", "endereco"];

    for (let i = 0; i < input.contacts.length; i++) {
      const contact = input.contacts[i];
      if (!contact) continue;

      try {
        const name = contact.name?.trim();
        if (!name) {
          results.errors.push({ row: i + 1, error: "Nome é obrigatório" });
          continue;
        }

        const phone = contact.phone?.trim() || "";
        const email = contact.email?.trim() || "";
        const tagsStr = contact.tags?.trim() || "";
        const tags = tagsStr
          ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

        // Campos novos
        const birthday = contact.data_nascimento?.trim() || null;
        const cep = contact.cep?.trim() || "";
        const endereco = contact.endereco?.trim() || "";

        // Extrair variáveis customizadas (campos que não são fixos)
        const metadata: { label: string; value: string }[] = [];
        for (const [key, value] of Object.entries(contact)) {
          if (!fixedFields.includes(key) && value) {
            metadata.push({ label: key, value: String(value).trim() });
          }
        }

        // Adicionar email como metadata se existir
        if (email) {
          metadata.push({ label: "email", value: email });
        }

        // Adicionar CEP como metadata se existir
        if (cep) {
          metadata.push({ label: "cep", value: cep });
        }

        // Adicionar endereço como metadata se existir
        if (endereco) {
          metadata.push({ label: "endereco", value: endereco });
        }

        // Verificar se já existe um contato com esse telefone
        let existingPartner: Partner | null = null;
        if (phone) {
          existingPartner = await partnersRepository.retrieveByContactValue(
            phone,
            ctx.membership.workspaceId
          );
        }

        if (existingPartner) {
          // Atualizar contato existente
          existingPartner.setCustomName(name);
          // Tags foram substituídas por labels - ignorar no import
          if (birthday) {
            existingPartner.setBirthday(new Date(birthday));
          }
          existingPartner.setMetadata(
            metadata.map((m) => Metadata.create(m.label, m.value))
          );
          await partnersRepository.upsert(existingPartner, ctx.membership.workspaceId);
          results.updated++;
        } else {
          // Criar novo contato
          const contacts = phone
            ? [
                {
                  id: crypto.randomUUID(),
                  type: "whatsapp" as const,
                  value: phone,
                  channelId: null,
                },
              ]
            : [];

          const partner = Partner.create({
            name,
            contacts,
            metadata,
            birthday: birthday ? new Date(birthday) : null,
          });
          partner.setCustomName(name);

          await partnersRepository.upsert(partner, ctx.membership.workspaceId);
          results.imported++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        results.errors.push({ row: i + 1, error: errorMessage });
      }
    }

    revalidatePath("/clients", "page");
    return results;
  });

// Gerar template CSV para importação
export const getImportTemplate = securityProcedure(["manage:partners"])
  .handler(async () => {
    const headers = [
      "nome",
      "telefone",
      "data_nascimento",
      "cep",
      "endereco",
      "email",
      "tags",
      "var1",
      "var2",
    ];

    const exampleRow = [
      "João Silva",
      "5511999999999",
      "1990-05-15",
      "01310-100",
      "Av. Paulista, 1000 - São Paulo/SP",
      "joao@email.com",
      "cliente, vip",
      "valor1",
      "valor2",
    ];

    return {
      headers,
      exampleRow,
      instructions: [
        "O campo 'nome' é obrigatório",
        "O campo 'telefone' deve estar no formato internacional (ex: 5511999999999)",
        "O campo 'data_nascimento' deve estar no formato AAAA-MM-DD (ex: 1990-05-15)",
        "O campo 'cep' deve estar no formato 99999-999 ou apenas números",
        "O campo 'endereco' é texto livre para o endereço completo",
        "O campo 'tags' pode conter múltiplas tags separadas por vírgula",
        "Você pode adicionar colunas extras para variáveis customizadas (var1, var2, etc.)",
        "Se um telefone já existir, o contato será atualizado",
      ],
    };
  });
