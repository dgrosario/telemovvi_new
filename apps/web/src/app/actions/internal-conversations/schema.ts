import z from "zod";

export const createInternalConversationSchema = z.object({
  participantIds: z.array(z.string()).min(1, "At least one participant is required"),
  name: z.string().optional(),
});

export const sendInternalMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1, "Message content is required"),
  type: z.enum(["text", "audio", "image", "sticker", "document", "video"]).default("text"),
  caption: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
});

export const addParticipantToGroupSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export const removeParticipantFromGroupSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
});

export const leaveInternalConversationSchema = z.object({
  conversationId: z.string(),
});

export const getInternalConversationSchema = z.object({
  conversationId: z.string(),
});
