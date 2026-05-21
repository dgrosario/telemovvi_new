import z from "zod";

export const upsertPartnersInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "Nome é obrigatório" }),
  tags: z.array(z.string().min(1)).optional().default([]),
  labelIds: z.array(z.string()).optional().default([]),
  birthday: z.string().nullable().optional(),
  contacts: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["whatsapp", "instagram", "evolution", "meta_api"]),
      value: z.string().min(1, { message: "Valor do contato é obrigatório" }),
      channelId: z.string().nullable().optional(),
      createdAt: z.string().optional(),
    })
  ),
  metadata: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ).transform((metadata) => 
    // Filtra metadata com label ou value vazios
    metadata.filter((m) => m.label.trim() !== "" && m.value.trim() !== "")
  ),
});

export const listPartnersInputSchema = z.object({
  pageIndex: z.number().optional().default(0),
  channelFilters: z.array(z.string()).optional().default([]),
  query: z.string().optional().default(""),
});

export const retrievePartnerInputSchema = z.object({
  id: z.string(),
  sectorId: z.string().nullable().optional(),
});

export const searchPartnerInputSchema = z.object({
  query: z.string(),
});

export const removePartnersInputSchema = z.object({
  ids: z.array(z.string()),
});
