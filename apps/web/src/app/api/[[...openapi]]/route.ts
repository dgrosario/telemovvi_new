import {
  refreshConversations,
  retrieveConversation,
} from "@/app/actions/conversations";
import {
  markLastMessagesContactAsViewed,
  retrieveMedia,
  sendMessage,
  sendTyping,
} from "@/app/actions/messages";
import { sse } from "@/app/actions/sse";
import {
  createOpenApiServerActionRouter,
  createRouteHandlers,
} from "zsa-openapi";

const router = createOpenApiServerActionRouter({
  pathPrefix: "/api",
})
  .get("/sse", sse)
  .get("/conversation/{conversationId}", retrieveConversation)
  .get("/message/{messageId}/media", retrieveMedia)
  .post("/message/viewed", markLastMessagesContactAsViewed)
  .post("/message/send", sendMessage)
  .post("/message/typing", sendTyping)
  .get("/refresh", refreshConversations);

export const { GET, POST, PUT, DELETE } = createRouteHandlers(router) as any;
