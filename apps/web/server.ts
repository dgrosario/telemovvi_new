import fs from "fs";
import { execSync } from "child_process";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import next from "next";
import { Server } from "socket.io";
import cron from "node-cron";
const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev, customServer: true });
const handle = app.getRequestHandler();

function ensureSelfSignedSSL() {
  const dir = "./certificates";
  const keyPath = `${dir}/localhost-key.pem`;
  const certPath = `${dir}/localhost.pem`;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log("[SSL] Nenhum certificado SSL encontrado. Gerando...");
    try {
      execSync(`cd ${dir} && mkcert localhost`);
      console.log("[SSL] Certificado SSL autoassinado criado com sucesso!");
    } catch (err) {
      console.error("[SSL] Erro ao gerar certificado SSL:", err);
    }
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim()
  );

  if (dev) {
    const devOrigins = [
      `https://localhost:${port}`,
      "https://localhost:3000",
      "https://localhost:3001",
    ];
    return envOrigins?.length ? [...devOrigins, ...envOrigins] : devOrigins;
  }

  return envOrigins || [];
}

type UserPresence = {
  userId: string;
  socketId: string;
  lastHeartbeat: number;
};

const PRESENCE_TIMEOUT = 60000;

function createSocketServer(server: any) {
  if (global.io) {
    console.log("Reutilizando instancia Socket.IO existente");
    return global.io;
  }

  const allowedOrigins = getAllowedOrigins();
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  const workspacePresence: Map<string, Map<string, UserPresence>> = new Map();
  const socketToWorkspace: Map<string, { workspaceId: string; userId: string }> = new Map();

  const cleanupStalePresence = () => {
    const now = Date.now();
    workspacePresence.forEach((users, workspaceId) => {
      users.forEach((presence, odUserId) => {
        if (now - presence.lastHeartbeat > PRESENCE_TIMEOUT) {
          users.delete(odUserId);
          io.to(`workspace:${workspaceId}`).emit("presence:offline", {
            userId: presence.userId,
            isOnline: false,
          });
        }
      });
    });
  };

  setInterval(cleanupStalePresence, 30000);

  io.on("connection", (socket) => {
    console.log("[Socket.IO] Cliente conectado:", socket.id);

    socket.on("join-workspace", (workspaceId: string) => {
      if (workspaceId) {
        socket.join(`workspace:${workspaceId}`);
        console.log(
          `[Socket.IO] ${socket.id} entrou no workspace:${workspaceId}`
        );

        const users = workspacePresence.get(workspaceId);
        if (users) {
          const onlineUserIds = Array.from(users.values()).map((p) => p.userId);
          socket.emit("presence:list", { users: onlineUserIds });
        }
      }
    });

    socket.on("leave-workspace", (workspaceId: string) => {
      if (workspaceId) {
        socket.leave(`workspace:${workspaceId}`);
        console.log(`[Socket.IO] ${socket.id} saiu do workspace:${workspaceId}`);

        const mapping = socketToWorkspace.get(socket.id);
        if (mapping && mapping.workspaceId === workspaceId) {
          const users = workspacePresence.get(workspaceId);
          if (users) {
            users.delete(mapping.userId);
            io.to(`workspace:${workspaceId}`).emit("presence:offline", {
              userId: mapping.userId,
              isOnline: false,
            });
          }
          socketToWorkspace.delete(socket.id);
        }
      }
    });

    socket.on("presence:heartbeat", (data: { userId: string }) => {
      const rooms = Array.from(socket.rooms);
      const workspaceRoom = rooms.find((r) => r.startsWith("workspace:"));
      if (!workspaceRoom || !data.userId) return;

      const workspaceId = workspaceRoom.replace("workspace:", "");

      socket.join(`user:${data.userId}`);

      if (!workspacePresence.has(workspaceId)) {
        workspacePresence.set(workspaceId, new Map());
      }

      const users = workspacePresence.get(workspaceId)!;
      const wasOnline = users.has(data.userId);

      users.set(data.userId, {
        userId: data.userId,
        socketId: socket.id,
        lastHeartbeat: Date.now(),
      });

      socketToWorkspace.set(socket.id, { workspaceId, userId: data.userId });

      if (!wasOnline) {
        io.to(`workspace:${workspaceId}`).emit("presence:online", {
          userId: data.userId,
          isOnline: true,
        });
      }
    });

    socket.on("message", (msg) => io.emit("message", msg));

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Cliente desconectado:", socket.id);

      const mapping = socketToWorkspace.get(socket.id);
      if (mapping) {
        const users = workspacePresence.get(mapping.workspaceId);
        if (users) {
          users.delete(mapping.userId);
          io.to(`workspace:${mapping.workspaceId}`).emit("presence:offline", {
            userId: mapping.userId,
            isOnline: false,
          });
        }
        socketToWorkspace.delete(socket.id);
      }
    });
  });

  global.io = io;
  return io;
}

function startCronScheduler() {
  const baseUrl = `http://localhost:${port}`;
  const authHeaders = {
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  };

  // Process campaigns every minute
  cron.schedule("* * * * *", async () => {
    try {
      const response = await fetch(`${baseUrl}/api/cron/campaigns`, {
        method: "GET",
        headers: authHeaders,
      });

      if (!response.ok) {
        console.error(`[Cron] Campaigns job failed: ${response.status}`);
        return;
      }

      const result = await response.json();
      const scheduled = result.scheduledCampaigns?.started || 0;
      const birthday = result.birthdayCampaigns?.newRecipients || 0;
      const batches = result.batchExecution?.processed || 0;

      if (scheduled > 0 || birthday > 0 || batches > 0) {
        console.log(
          `[Cron] Campaigns: ${scheduled} started, ${birthday} birthday recipients, ${batches} batches processed`
        );
      }
    } catch (error) {
      console.error("[Cron] Error processing campaigns:", error);
    }
  });

  console.log("[Cron] Campaign scheduler started (every minute)");

  // Sync WhatsApp group names every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const response = await fetch(`${baseUrl}/api/cron/group-names`, {
        method: "GET",
        headers: authHeaders,
      });

      if (!response.ok) {
        console.error(`[Cron] Group names job failed: ${response.status}`);
        return;
      }

      const result = await response.json();
      const updatedGroups = result.updatedGroups || 0;
      const updatedConversations = result.updatedConversations || 0;
      const failedGroups = result.failedGroups || 0;

      if (updatedGroups > 0 || failedGroups > 0) {
        console.log(
          `[Cron] Group names: ${updatedGroups} grupos atualizados, ${updatedConversations} conversas atualizadas, ${failedGroups} falhas`
        );
      }
    } catch (error) {
      console.error("[Cron] Error syncing group names:", error);
    }
  });

  console.log("[Cron] Group name sync scheduler started (every 10 minutes)");

  // Cleanup orphan Evolution instances every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const response = await fetch(`${baseUrl}/api/cron/evolution-orphans`, {
        method: "GET",
        headers: authHeaders,
      });

      if (!response.ok) {
        console.error(
          `[Cron] Evolution orphan cleanup job failed: ${response.status}`
        );
        return;
      }

      const result = await response.json();
      const orphansProcessed = result.orphansProcessed || 0;
      const failures = Array.isArray(result.failures) ? result.failures.length : 0;
      const skippedByLimit = result.orphansSkippedByLimit || 0;

      if (orphansProcessed > 0 || failures > 0 || skippedByLimit > 0) {
        console.log(
          `[Cron] Evolution orphans: ${orphansProcessed} removidas, ${failures} falhas, ${skippedByLimit} puladas por limite`
        );
      }
    } catch (error) {
      console.error("[Cron] Error cleaning orphan Evolution instances:", error);
    }
  });

  console.log("[Cron] Evolution orphan cleanup scheduler started (every 10 minutes)");

  // Reprocess DLQ messages every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const response = await fetch(`${baseUrl}/api/cron/dlq-reprocess`, {
        method: "GET",
        headers: authHeaders,
      });

      if (!response.ok) {
        console.error(
          `[Cron] DLQ reprocess job failed: ${response.status}`
        );
        return;
      }

      const result = await response.json();
      if (result.processed > 0) {
        console.log(
          `[Cron] DLQ: ${result.republished} republished, ${result.expired} expired, ${result.discarded} discarded`
        );
      }
    } catch (error) {
      console.error("[Cron] Error reprocessing DLQ:", error);
    }
  });

  console.log("[Cron] DLQ reprocess scheduler started (every hour)");
}

app.prepare().then(() => {
  let server;

  if (dev) {
    const ssl = ensureSelfSignedSSL();
    server = createHttpsServer(ssl, (req, res) => handle(req, res));
    console.log("[HTTPS] Modo DEV: Servidor HTTPS ativado com SSL autoassinado");
  } else {
    server = createHttpServer((req, res) => handle(req, res));
    console.log("[HTTP] Modo PROD: Servidor HTTP ativado (proxy HTTPS externo)");
  }

  const io = createSocketServer(server);

  import("./src/lib/meta-sent-consumer")
    .then(({ startMetaSentConsumer }) => {
      startMetaSentConsumer(io).catch((error) => {
        console.error("Failed to start Meta Sent consumer:", error);
      });
    })
    .catch((error) => {
      console.error("Failed to load meta-sent-consumer module:", error);
    });

  // Sequential: InboundMessageConsumer must be ready BEFORE GatewayChannelConsumer
  // GatewayChannelConsumer uses global.inboundMessageConsumer for dynamic instance registration
  (async () => {
    try {
      const { startInboundMessageConsumer } = await import("./src/lib/inbound-message-consumer");
      const consumer = await startInboundMessageConsumer(io);
      global.inboundMessageConsumer = consumer;
      console.log("[Server] InboundMessageConsumer stored globally for dynamic registration");
    } catch (error) {
      console.error("Failed to start Inbound Message consumer:", error);
    }

    try {
      console.log("[Server] About to load GatewayChannelConsumer...");
      const { startGatewayChannelConsumer } = await import("./src/lib/gateway-channel-consumer");
      console.log("[Server] Loading GatewayChannelConsumer module...");
      const consumer = await startGatewayChannelConsumer(io);
      global.gatewayChannelConsumer = consumer;
      console.log("[Server] GatewayChannelConsumer started and stored globally");
    } catch (error) {
      console.error("Failed to start Gateway Channel consumer:", error);
    }
  })();

  import("./src/lib/instagram-inbound-consumer")
    .then(({ startInstagramInboundConsumer }) => {
      startInstagramInboundConsumer(io).catch((error) => {
        console.error("Failed to start Instagram Inbound consumer:", error);
      });
    })
    .catch((error) => {
      console.error("Failed to load instagram-inbound-consumer module:", error);
    });

  import("./src/lib/internal-message-consumer")
    .then(({ startInternalMessageConsumer }) => {
      startInternalMessageConsumer(io).catch((error) => {
        console.error("Failed to start Internal Message consumer:", error);
      });
    })
    .catch((error) => {
      console.error("Failed to load internal-message-consumer module:", error);
    });

  let flowResumeHealthCheckInterval: NodeJS.Timeout | null = null;
  let isFlowResumeConsumerRestarting = false;
  let flowResumeRestartAttempts = 0;
  const MAX_RESTART_ATTEMPTS = 10;
  const HEALTH_CHECK_INTERVAL_MS = 30000;

  console.log("[Server] Loading FlowResumeConsumer module...");
  import("./src/lib/flow-resume-consumer")
    .then(({ startFlowResumeConsumer }) => {
      console.log("[Server] FlowResumeConsumer module loaded, starting consumer...");
      startFlowResumeConsumer()
        .then((consumer) => {
          global.flowResumeConsumer = consumer;
          console.log("[Server] FlowResumeConsumer started successfully");

          // Initial verification: ensure consumer is actually consuming after 5s
          setTimeout(async () => {
            if (!consumer.isRunning()) {
              console.warn(
                "[Server] FlowResumeConsumer not consuming after 5s - attempting restart..."
              );
              try {
                await consumer.start();
                if (consumer.isRunning()) {
                  console.log("[Server] FlowResumeConsumer restarted successfully on initial check");
                } else {
                  console.error(
                    "[Server] FlowResumeConsumer still not running after restart attempt - check RABBITMQ_URL configuration"
                  );
                }
              } catch (retryError) {
                console.error("[Server] Failed to restart FlowResumeConsumer on initial check:", retryError);
              }
            } else {
              console.log("[Server] FlowResumeConsumer verified running after 5s");
            }
          }, 5000);

          // Health check: restart consumer if it stops unexpectedly
          flowResumeHealthCheckInterval = setInterval(async () => {
            const currentConsumer = global.flowResumeConsumer;

            try {
              if (!currentConsumer || isFlowResumeConsumerRestarting) {
                return;
              }

              if (currentConsumer.isRunning()) {
                flowResumeRestartAttempts = 0;
                return;
              }

              if (flowResumeRestartAttempts >= MAX_RESTART_ATTEMPTS) {
                console.error(
                  `[Server] CRITICAL: FlowResumeConsumer exceeded max restart attempts (${MAX_RESTART_ATTEMPTS}). ` +
                  `Manual intervention required. Flow resume functionality is disabled until server restart.`
                );
                console.error(
                  `[Server] Action required: Check RabbitMQ connection, review logs, and restart the server.`
                );
                if (flowResumeHealthCheckInterval) {
                  clearInterval(flowResumeHealthCheckInterval);
                  flowResumeHealthCheckInterval = null;
                }
                return;
              }

              isFlowResumeConsumerRestarting = true;
              flowResumeRestartAttempts++;
              console.warn(
                `[Server] FlowResumeConsumer stopped unexpectedly, restarting... (attempt ${flowResumeRestartAttempts}/${MAX_RESTART_ATTEMPTS})`
              );

              try {
                await currentConsumer.stop();
              } catch {
                // Ignore stop errors - consumer may already be stopped
              }

              try {
                await currentConsumer.start();
                console.log("[Server] FlowResumeConsumer restarted successfully");
                flowResumeRestartAttempts = 0;
              } catch (restartError) {
                console.error("[Server] Failed to restart FlowResumeConsumer:", restartError);
              }
            } catch (healthCheckError) {
              console.error("[Server] Health check error:", healthCheckError);
            } finally {
              isFlowResumeConsumerRestarting = false;
            }
          }, HEALTH_CHECK_INTERVAL_MS);
        })
        .catch((error) => {
          console.error("[Server] Failed to start FlowResumeConsumer:", error);
          console.error("[Server] FlowResumeConsumer error stack:", error instanceof Error ? error.stack : "No stack available");
        });
    })
    .catch((error) => {
      console.error("[Server] Failed to load flow-resume-consumer module:", error);
      console.error("[Server] Module load error stack:", error instanceof Error ? error.stack : "No stack available");
    });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] ${signal} received, shutting down gracefully...`);

    try {
      if (flowResumeHealthCheckInterval) {
        clearInterval(flowResumeHealthCheckInterval);
        flowResumeHealthCheckInterval = null;
      }

      if (global.flowResumeConsumer) {
        console.log("[Server] Stopping FlowResumeConsumer...");
        await global.flowResumeConsumer.stop();
      }

      server.close(() => {
        console.log("[Server] HTTP server closed");
        process.exit(0);
      });

      // Force exit after timeout
      setTimeout(() => {
        console.error("[Server] Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    } catch (error) {
      console.error("[Server] Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  server.listen(port, () => {
    console.log(
      `Servidor rodando em ${dev ? "https" : "http"}://localhost:${port}`
    );

    // Start cron scheduler after server is ready
    if (process.env.CRON_SECRET) {
      startCronScheduler();
    } else {
      console.log("[Cron] CRON_SECRET not configured - scheduler disabled");
    }
  });
});
