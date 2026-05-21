"use client";

import { useSocketEvents } from "@/hooks/use-socket-events";
import { useEffect, useState } from "react";

export function SocketEventsInitializer() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <SocketEventsInitializerInner />;
}

function SocketEventsInitializerInner() {
  useSocketEvents();
  return null;
}
