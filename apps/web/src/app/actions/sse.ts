import { sseEmitter } from "@/lib/sse";
import { securityProcedure } from "./procedure";

export const sse = securityProcedure([
  "list:conversation",
]).handler(async ({ request }) => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          try {
            controller.close();
          } catch {}
        }
      };

      sendEvent({ type: "connected" });

      const keepAlive = setInterval(() => {
        sendEvent({ type: "ping" });
      }, 1000);

      const onMessage = (type: string) => {
        return (data: any) => {
          sendEvent({
            type,
            data,
          });
        };
      };

      sseEmitter.on("conversation", onMessage("conversation"));
      sseEmitter.on("cart", onMessage("cart"));
      sseEmitter.on("typing", onMessage("typing"));
      sseEmitter.on("untyping", onMessage("untyping"));

      request?.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        sseEmitter.removeListener("message", onMessage);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
