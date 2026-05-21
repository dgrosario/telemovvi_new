import z from "zod";

export const sendInternalCommentSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1, "O Conteúdo da nota e obrigatorio"),
});
