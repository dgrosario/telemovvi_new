import { Server } from "socket.io";

export function getSocketServer(): Server | null {
  return (global as any).io || null;
}
