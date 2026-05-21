import { io } from "socket.io-client";

export const createSocket = () =>
  io(
    process.env.NODE_ENV === "production"
      ? process.env.APP_DOMAIN
      : "https://localhost:3000",
    {
      transports: ["websocket"],
      secure: true,
      rejectUnauthorized: false,
    }
  );
