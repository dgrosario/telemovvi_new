"use client";

import { useSocket } from "@/providers/socket-provider";
import { useDashboardStore } from "./use-dashboard";
import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 30000;

type PresenceListEvent = {
  users: string[];
};

type PresenceUpdateEvent = {
  userId: string;
  isOnline: boolean;
};

export function useOnlinePresence(userId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const setOnlineUsers = useDashboardStore((state) => state.setOnlineUsers);
  const addOnlineUser = useDashboardStore((state) => state.addOnlineUser);
  const removeOnlineUser = useDashboardStore((state) => state.removeOnlineUser);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !isConnected || !userId) return;

    const sendHeartbeat = () => {
      socket.emit("presence:heartbeat", { userId });
    };

    const handlePresenceList = (event: PresenceListEvent) => {
      setOnlineUsers(event.users);
    };

    const handlePresenceOnline = (event: PresenceUpdateEvent) => {
      addOnlineUser(event.userId);
    };

    const handlePresenceOffline = (event: PresenceUpdateEvent) => {
      removeOnlineUser(event.userId);
    };

    socket.on("presence:list", handlePresenceList);
    socket.on("presence:online", handlePresenceOnline);
    socket.on("presence:offline", handlePresenceOffline);

    sendHeartbeat();

    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      socket.off("presence:list", handlePresenceList);
      socket.off("presence:online", handlePresenceOnline);
      socket.off("presence:offline", handlePresenceOffline);

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [socket, isConnected, userId, setOnlineUsers, addOnlineUser, removeOnlineUser]);
}
