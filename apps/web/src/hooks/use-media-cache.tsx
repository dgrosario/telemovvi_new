"use client";

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  ReactNode,
} from "react";

const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const TTL_MS = 30 * 60 * 1000; // 30 minutos

type MediaCacheEntry = {
  blobUrl: string;
  size: number;
  mimeType: string;
  lastAccessedAt: number;
  createdAt: number;
};

type MediaCacheResult = {
  blobUrl: string;
  mimeType: string;
  fromCache: boolean;
  isOversized?: boolean;
};

type MediaCacheOptions = {
  force?: boolean;
};

type MediaCacheContextValue = {
  getMedia: (
    messageId: string,
    channelId: string,
    options?: MediaCacheOptions
  ) => Promise<MediaCacheResult | null>;
  hasMedia: (messageId: string) => boolean;
  getCacheStats: () => { count: number; totalSize: number };
};

const MediaCacheContext = createContext<MediaCacheContextValue | null>(null);

export function MediaCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, MediaCacheEntry>>(new Map());
  const pendingRequestsRef = useRef<
    Map<string, Promise<MediaCacheResult | null>>
  >(new Map());
  const currentSizeRef = useRef(0);

  const cleanExpiredEntries = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    const entriesToDelete: string[] = [];

    cache.forEach((entry, key) => {
      if (now - entry.createdAt > TTL_MS) {
        entriesToDelete.push(key);
      }
    });

    entriesToDelete.forEach((key) => {
      const entry = cache.get(key);
      if (entry) {
        URL.revokeObjectURL(entry.blobUrl);
        currentSizeRef.current -= entry.size;
        cache.delete(key);
      }
    });
  }, []);

  const evictLRU = useCallback((requiredSpace: number) => {
    const cache = cacheRef.current;

    const entries = Array.from(cache.entries()).sort(
      (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
    );

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;

      URL.revokeObjectURL(entry.blobUrl);
      currentSizeRef.current -= entry.size;
      freedSpace += entry.size;
      cache.delete(key);
    }
  }, []);

  const ensureSpace = useCallback(
    (requiredSize: number) => {
      cleanExpiredEntries();

      const availableSpace = MAX_CACHE_SIZE - currentSizeRef.current;
      if (availableSpace >= requiredSize) return true;

      const spaceNeeded = requiredSize - availableSpace;
      evictLRU(spaceNeeded);

      return MAX_CACHE_SIZE - currentSizeRef.current >= requiredSize;
    },
    [cleanExpiredEntries, evictLRU]
  );

  const fetchMedia = useCallback(
    async (
      messageId: string,
      channelId: string,
      force?: boolean
    ): Promise<MediaCacheResult | null> => {
      try {
        const response = await fetch(
          `/api/message/${encodeURIComponent(messageId)}/media?channelId=${channelId}${force ? "&force=true" : ""}`
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error(
            `[MediaCache] HTTP ${response.status} for ${messageId}:`,
            errorBody
          );
          return null;
        }

        const buffer = await response.arrayBuffer();
        const size = buffer.byteLength;
        let mimeType =
          response.headers.get("Content-Type") || "application/octet-stream";

        if (mimeType === "application/octet-stream" && size >= 4) {
          const header = new Uint8Array(buffer.slice(0, 4));
          if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
            mimeType = "image/jpeg";
          } else if (
            header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
          ) {
            mimeType = "image/png";
          } else if (
            header[0] === 0x47 &&
            header[1] === 0x49 &&
            header[2] === 0x46
          ) {
            mimeType = "image/gif";
          } else if (
            header[0] === 0x52 &&
            header[1] === 0x49 &&
            header[2] === 0x46 &&
            header[3] === 0x46
          ) {
            mimeType = "image/webp";
          }
        }

        console.log(
          `[MediaCache] OK ${messageId}: ${mimeType}, ${size} bytes`
        );

        if (size > MAX_CACHE_SIZE) {
          const blob = new Blob([buffer], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          return {
            blobUrl,
            mimeType,
            fromCache: false,
            isOversized: true,
          };
        }

        const hasSpace = ensureSpace(size);
        const blob = new Blob([buffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        if (!hasSpace) {
          return {
            blobUrl,
            mimeType,
            fromCache: false,
            isOversized: true,
          };
        }

        const now = Date.now();
        const entry: MediaCacheEntry = {
          blobUrl,
          size,
          mimeType,
          lastAccessedAt: now,
          createdAt: now,
        };

        const existingEntry = cacheRef.current.get(messageId);
        if (existingEntry) {
          URL.revokeObjectURL(existingEntry.blobUrl);
          currentSizeRef.current -= existingEntry.size;
        }

        cacheRef.current.set(messageId, entry);
        currentSizeRef.current += size;

        return {
          blobUrl,
          mimeType,
          fromCache: false,
        };
      } catch (error) {
        console.error("[MediaCache] Error fetching media:", messageId, error);
        return null;
      }
    },
    [ensureSpace]
  );

  const getMedia = useCallback(
    async (
      messageId: string,
      channelId: string,
      options?: MediaCacheOptions
    ): Promise<MediaCacheResult | null> => {
      const cache = cacheRef.current;
      const force = options?.force;

      if (force) {
        const existing = cache.get(messageId);
        if (existing) {
          URL.revokeObjectURL(existing.blobUrl);
          currentSizeRef.current -= existing.size;
          cache.delete(messageId);
        }
      } else {
        const entry = cache.get(messageId);

        if (entry) {
          const now = Date.now();
          if (now - entry.createdAt <= TTL_MS) {
            entry.lastAccessedAt = now;
            return {
              blobUrl: entry.blobUrl,
              mimeType: entry.mimeType,
              fromCache: true,
            };
          }

          URL.revokeObjectURL(entry.blobUrl);
          currentSizeRef.current -= entry.size;
          cache.delete(messageId);
        }
      }

      const pendingRequests = pendingRequestsRef.current;
      const pendingKey = force ? `${messageId}:force` : messageId;
      const pendingRequest = pendingRequests.get(pendingKey);
      if (pendingRequest) {
        return pendingRequest;
      }

      const fetchPromise = fetchMedia(messageId, channelId, force).finally(() => {
        pendingRequests.delete(pendingKey);
      });

      pendingRequests.set(pendingKey, fetchPromise);
      return fetchPromise;
    },
    [fetchMedia]
  );

  const hasMedia = useCallback((messageId: string) => {
    const entry = cacheRef.current.get(messageId);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.createdAt > TTL_MS) {
      URL.revokeObjectURL(entry.blobUrl);
      currentSizeRef.current -= entry.size;
      cacheRef.current.delete(messageId);
      return false;
    }

    return true;
  }, []);

  const getCacheStats = useCallback(() => {
    cleanExpiredEntries();
    return {
      count: cacheRef.current.size,
      totalSize: currentSizeRef.current,
    };
  }, [cleanExpiredEntries]);

  return (
    <MediaCacheContext.Provider value={{ getMedia, hasMedia, getCacheStats }}>
      {children}
    </MediaCacheContext.Provider>
  );
}

export function useMediaCache() {
  const context = useContext(MediaCacheContext);
  if (!context) {
    throw new Error("useMediaCache must be used within a MediaCacheProvider");
  }
  return context;
}

export function useMediaCacheOptional() {
  return useContext(MediaCacheContext);
}
