"use server";

import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnersDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-repository";
import { Metadata } from "@omnichannel/core/domain/value-objects/metadata";
import { securityProcedure } from "../procedure";
import z from "zod";
import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

const partnersRepository = PartnersDatabaseRepository.instance();

// Schema para iniciar importação
const startImportJobSchema = z.object({
  contacts: z.array(z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    tags: z.string().optional(),
    data_nascimento: z.string().optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
  }).passthrough()),
});

// Iniciar job de importação (processa tudo no servidor)
export const startImportJob = securityProcedure(["manage:partners"])
  .input(startImportJobSchema)
  .handler(async ({ ctx, input }) => {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();

    console.log(`[Import Job ${jobId}] Iniciando importação de ${input.contacts.length} contatos`);

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ index: number; name: string; error: string }> = [];

    const fixedFields = ["name", "phone", "email", "tags", "data_nascimento", "cep", "endereco"];

    // Processar em lotes de 50 para não sobrecarregar
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(input.contacts.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, input.contacts.length);
      const batch = input.contacts.slice(start, end);

      console.log(`[Import Job ${jobId}] Processando lote ${batchIndex + 1}/${totalBatches}`);

      for (let i = 0; i < batch.length; i++) {
        const contact = batch[i];
        if (!contact) continue;

        try {
          const name = contact.name?.trim();
          if (!name) {
            errors.push({ index: start + i, name: "Sem nome", error: "Nome é obrigatório" });
            skipped++;
            continue;
          }

          const phone = contact.phone?.trim() || "";
          if (!phone) {
            errors.push({ index: start + i, name, error: "Telefone é obrigatório" });
            skipped++;
            continue;
          }

          // Verificar se já existe
          const existingPartner = await partnersRepository.retrieveByContactValue(
            phone,
            ctx.membership.workspaceId
          );

          if (existingPartner) {
            skipped++;
            continue;
          }

          // Preparar metadata
          const metadata: { label: string; value: string }[] = [];
          for (const [key, value] of Object.entries(contact)) {
            if (!fixedFields.includes(key) && value) {
              metadata.push({ label: key, value: String(value).trim() });
            }
          }

          const email = contact.email?.trim() || "";
          const cep = contact.cep?.trim() || "";
          const endereco = contact.endereco?.trim() || "";

          if (email) metadata.push({ label: "email", value: email });
          if (cep) metadata.push({ label: "cep", value: cep });
          if (endereco) metadata.push({ label: "endereco", value: endereco });

          // Processar data de nascimento
          let birthdayDate: Date | null = null;
          const birthday = contact.data_nascimento?.trim();
          if (birthday) {
            try {
              if (birthday.includes("/")) {
                const [day, month, year] = birthday.split("/");
                birthdayDate = new Date(`${year}-${month}-${day}`);
              } else {
                birthdayDate = new Date(birthday);
              }
              if (isNaN(birthdayDate.getTime())) birthdayDate = null;
            } catch (e) {
              birthdayDate = null;
            }
          }

          // Criar contato
          const partner = Partner.create({
            name,
            contacts: [{
              id: crypto.randomUUID(),
              type: "whatsapp" as const,
              value: phone,
              channelId: null,
            }],
            metadata,
            birthday: birthdayDate,
          });

          await partnersRepository.upsert(partner, ctx.membership.workspaceId);
          imported++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
          errors.push({ index: start + i, name: contact.name || "Sem nome", error: errorMessage });
          skipped++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Import Job ${jobId}] Concluído em ${duration}ms: ${imported} importados, ${skipped} pulados`);

    revalidatePath("/clients", "page");

    return {
      jobId,
      imported,
      skipped,
      errors: errors.slice(0, 100), // Limitar erros retornados
      duration,
    };
  });


// Iniciar job de exportação (gera arquivo no servidor)
export const startExportJob = securityProcedure(["manage:partners"])
  .handler(async ({ ctx }) => {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();

    console.log(`[Export Job ${jobId}] Iniciando exportação`);

    // Buscar todos os contatos
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

    console.log(`[Export Job ${jobId}] Encontrados ${allPartners.length} contatos`);

    // Campos fixos
    const fixedMetadataFields = ["cep", "endereco", "email"];

    // Coletar labels de metadata
    const allMetadataLabels = new Set<string>();
    for (const partner of allPartners) {
      for (const meta of partner.metadata) {
        if (!fixedMetadataFields.includes(meta.label)) {
          allMetadataLabels.add(meta.label);
        }
      }
    }

    const metadataLabels = Array.from(allMetadataLabels).sort();
    const headers = ["nome", "telefone", "data_nascimento", "cep", "endereco", "email", "tags", ...metadataLabels];

    // Criar linhas do CSV
    const rows = allPartners.map((partner) => {
      const phone = partner.contacts.find(
        (c) => c.type === "whatsapp" || c.type === "evolution" || c.type === "meta_api"
      )?.value || "";

      const cep = partner.metadata.find((m) => m.label === "cep")?.value || "";
      const endereco = partner.metadata.find((m) => m.label === "endereco")?.value || "";
      const email = partner.metadata.find((m) => m.label === "email")?.value || "";

      const metadataValues: Record<string, string> = {};
      for (const meta of partner.metadata) {
        if (!fixedMetadataFields.includes(meta.label)) {
          metadataValues[meta.label] = meta.value;
        }
      }

      return [
        partner.name,
        phone,
        partner.birthday || "",
        cep,
        endereco,
        email,
        "", // tags (vazio por enquanto)
        ...metadataLabels.map((label) => metadataValues[label] || ""),
      ];
    });

    // Gerar CSV
    const csvContent = [
      headers.join(";"),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
      ),
    ].join("\n");

    // Salvar arquivo temporário
    const uploadsDir = path.join(process.cwd(), "public", "temp-exports");
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `contatos_${ctx.membership.workspaceId}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, "\ufeff" + csvContent, "utf-8");

    const duration = Date.now() - startTime;
    console.log(`[Export Job ${jobId}] Concluído em ${duration}ms: ${allPartners.length} contatos exportados`);

    return {
      jobId,
      totalContacts: allPartners.length,
      downloadUrl: `/temp-exports/${fileName}`,
      fileName,
      duration,
    };
  });

// Limpar arquivos antigos de exportação (executar periodicamente)
export const cleanupOldExports = securityProcedure(["manage:partners"])
  .handler(async () => {
    const uploadsDir = path.join(process.cwd(), "public", "temp-exports");
    
    try {
      const files = await fs.readdir(uploadsDir);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      let deleted = 0;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > ONE_HOUR) {
          await fs.unlink(filePath);
          deleted++;
        }
      }

      console.log(`[Cleanup] Removidos ${deleted} arquivos antigos`);
      return { deleted };
    } catch (error) {
      console.error("[Cleanup] Erro ao limpar arquivos:", error);
      return { deleted: 0 };
    }
  });
