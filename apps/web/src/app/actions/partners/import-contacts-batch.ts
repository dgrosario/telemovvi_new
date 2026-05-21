"use server";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnersDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-repository";
import { Metadata } from "@omnichannel/core/domain/value-objects/metadata";
import { securityProcedure } from "../procedure";
import z from "zod";

const partnersRepository = PartnersDatabaseRepository.instance();

const importContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  tags: z.string().optional(),
  data_nascimento: z.string().optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
}).passthrough();

const importContactsBatchInputSchema = z.object({
  contacts: z.array(importContactSchema),
  batchId: z.string(),
  batchIndex: z.number(),
  totalBatches: z.number(),
});

// Processar um lote de contatos
export const importContactsBatch = securityProcedure(["manage:partners"])
  .input(importContactsBatchInputSchema)
  .handler(async ({ ctx, input }) => {
    console.log(`[Import Batch] Iniciando lote ${input.batchIndex + 1}/${input.totalBatches} com ${input.contacts.length} contatos`);
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ index: number; name: string; error: string }> = [];

    const fixedFields = ["name", "phone", "email", "tags", "data_nascimento", "cep", "endereco"];

    for (let i = 0; i < input.contacts.length; i++) {
      const contact = input.contacts[i];
      if (!contact) continue;

      try {
        const name = contact.name?.trim();
        if (!name) {
          errors.push({ 
            index: i, 
            name: contact.name || "Sem nome", 
            error: "Nome é obrigatório" 
          });
          skipped++;
          continue;
        }

        const phone = contact.phone?.trim() || "";
        if (!phone) {
          errors.push({ 
            index: i, 
            name, 
            error: "Telefone é obrigatório" 
          });
          skipped++;
          continue;
        }

        const email = contact.email?.trim() || "";
        const birthday = contact.data_nascimento?.trim() || null;
        const cep = contact.cep?.trim() || "";
        const endereco = contact.endereco?.trim() || "";

        // Extrair variáveis customizadas
        const metadata: { label: string; value: string }[] = [];
        for (const [key, value] of Object.entries(contact)) {
          if (!fixedFields.includes(key) && value) {
            metadata.push({ label: key, value: String(value).trim() });
          }
        }

        // Adicionar campos como metadata
        if (email) metadata.push({ label: "email", value: email });
        if (cep) metadata.push({ label: "cep", value: cep });
        if (endereco) metadata.push({ label: "endereco", value: endereco });

        // Verificar se já existe
        let existingPartner: Partner | null = null;
        try {
          existingPartner = await partnersRepository.retrieveByContactValue(
            phone,
            ctx.membership.workspaceId
          );
        } catch (err) {
          console.error(`[Import Batch] Erro ao buscar contato ${phone}:`, err);
        }

        if (existingPartner) {
          // Contato já existe - pular (não atualizar)
          console.log(`[Import Batch] Contato já existe, pulando: ${name} (${phone})`);
          skipped++;
          continue;
        }

        // Criar novo contato
        const contacts = [
          {
            id: crypto.randomUUID(),
            type: "whatsapp" as const,
            value: phone,
            channelId: null,
          },
        ];

        let birthdayDate: Date | null = null;
        if (birthday) {
          try {
            if (birthday.includes("/")) {
              const [day, month, year] = birthday.split("/");
              birthdayDate = new Date(`${year}-${month}-${day}`);
            } else {
              birthdayDate = new Date(birthday);
            }
            
            if (isNaN(birthdayDate.getTime())) {
              birthdayDate = null;
            }
          } catch (e) {
            birthdayDate = null;
          }
        }

        const partner = Partner.create({
          name,
          contacts,
          metadata,
          birthday: birthdayDate,
        });

        await partnersRepository.upsert(partner, ctx.membership.workspaceId);
        imported++;
      } catch (error) {
        console.error(`[Import Batch] Erro ao processar contato ${i}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        errors.push({ 
          index: i, 
          name: contact.name || "Sem nome", 
          error: errorMessage 
        });
        skipped++;
      }
    }

    console.log(`[Import Batch] Lote ${input.batchIndex + 1} concluído: ${imported} importados, ${updated} atualizados, ${skipped} ignorados`);

    // Retornar objeto simples e serializável
    return {
      imported,
      updated,
      skipped,
      errors,
      batchIndex: input.batchIndex,
      totalBatches: input.totalBatches,
    };
  });
