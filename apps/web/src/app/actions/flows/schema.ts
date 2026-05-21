import z from "zod";

export const createFlowInputSchema = z.object({
  name: z.string().min(1, { message: "Nome do flow é obrigatório" }),
  status: z.enum(["active", "inactive", "draft"]).optional(),
});

export const updateFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
  name: z.string().min(1).optional(),
  status: z.enum(["active", "inactive", "draft"]).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["start", "message", "menu", "interval", "transfer", "template", "conditional", "action", "subflow", "random", "input", "end"]),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
        data: z.record(z.unknown()),
      })
    )
    .optional(),
  connections: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().nullable(),
      })
    )
    .optional(),
});

export const deleteFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
});

export const duplicateFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
});

export const getFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
});

export const executeFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
  conversationId: z.string().min(1, { message: "ID da conversa é obrigatório" }),
});

export const associateFlowWithChannelsInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
  channelIds: z.array(z.string()).default([]),
});

export const listChannelsForFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
});

export const associateFlowWithSectorsInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
  sectorIds: z.array(z.string()).default([]),
});

export const listSectorsForFlowInputSchema = z.object({
  flowId: z.string().min(1, { message: "ID do flow é obrigatório" }),
});
