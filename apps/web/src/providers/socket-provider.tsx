"use client";

import { createSocket } from "@/lib/io";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  joinWorkspace: (workspaceId: string) => void;
  leaveWorkspace: (workspaceId: string) => void;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  connectionStatus: "disconnected",
  joinWorkspace: () => {},
  leaveWorkspace: () => {},
});

type SocketProviderProps = {
  children: React.ReactNode;
  workspaceId: string;
};

export function SocketProvider({ children, workspaceId }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const currentWorkspaceRef = useRef<string | null>(null);

  const joinWorkspace = useCallback((wsId: string) => {
    if (socketRef.current && wsId) {
      socketRef.current.emit("join-workspace", wsId);
      currentWorkspaceRef.current = wsId;
    }
  }, []);

  const leaveWorkspace = useCallback((wsId: string) => {
    if (socketRef.current && wsId) {
      socketRef.current.emit("leave-workspace", wsId);
      if (currentWorkspaceRef.current === wsId) {
        currentWorkspaceRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = createSocket();
    }

    const socket = socketRef.current;

    const onConnect = () => {
      setIsConnected(true);
      setConnectionStatus("connected");
      console.log("[SocketProvider] Conectado ao servidor");
      if (workspaceId) {
        joinWorkspace(workspaceId);
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
      console.log("[SocketProvider] Desconectado do servidor");
    };

    const onReconnectAttempt = () => {
      setConnectionStatus("reconnecting");
      console.log("[SocketProvider] Tentando reconectar...");
    };

    const onConnectError = () => {
      setConnectionStatus("disconnected");
      console.log("[SocketProvider] Erro de conexao");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("connect_error", onConnectError);

    if (socket.connected) {
      onConnect();
    } else {
      setConnectionStatus("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("connect_error", onConnectError);
    };
  }, [workspaceId, joinWorkspace]);

  useEffect(() => {
    if (isConnected && workspaceId && currentWorkspaceRef.current !== workspaceId) {
      if (currentWorkspaceRef.current) {
        leaveWorkspace(currentWorkspaceRef.current);
      }
      joinWorkspace(workspaceId);
    }
  }, [workspaceId, isConnected, joinWorkspace, leaveWorkspace]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        connectionStatus,
        joinWorkspace,
        leaveWorkspace,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
