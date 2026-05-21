import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SSEOptions<T> = {
  url: string;
  onMessage?: (data: T) => void;
  onError?: (err: any) => void;
  heartbeatTimeout?: number;
};
export function useSSE<T extends { type: string } = any>(props: SSEOptions<T>) {
  const { url, onMessage, onError, heartbeatTimeout = 30000 } = props;
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef<typeof onMessage>(null);
  const [connected, setConnected] = useState(false);
  const { replace } = useRouter();
  const counter = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const parsed = JSON.parse(event.data) as T;

    if (parsed?.type === "connected") {
      setConnected(true);
      return;
    }

    if (parsed?.type === "ping") {
      resetHeartbeat();
      return;
    }

    onMessageRef.current?.(parsed);
  }, []);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
  };

  const resetHeartbeat = () => {
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
    heartbeatTimer.current = setTimeout(() => {
      setConnected(false);
      cleanup();
      connect();
    }, heartbeatTimeout);
  };

  const connect = useCallback(() => {
    if (counter.current > 3) {
      replace("/signin");
      return;
    }

    if (
      eventSourceRef.current &&
      (eventSourceRef.current.readyState === EventSource.OPEN ||
        eventSourceRef.current.readyState === EventSource.CONNECTING)
    ) {
      return;
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = handleMessage;
    es.onerror = (err) => {
      setConnected(false);
      onError?.(err);
      cleanup();
      counter.current += 1;
      connect();
    };
  }, [url, replace, onError, handleMessage]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect]);

  return { connected };
}
