"use client";

import { createContext, useContext, useCallback, useRef, ReactNode } from "react";

type AudioPlayerContextValue = {
  registerAudio: (id: string, audioElement: HTMLAudioElement) => void;
  unregisterAudio: (id: string) => void;
  playAudio: (id: string) => void;
  pauseAudio: (id: string) => void;
  getCurrentPlayingId: () => string | null;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentPlayingIdRef = useRef<string | null>(null);

  const registerAudio = useCallback((id: string, audioElement: HTMLAudioElement) => {
    audioMapRef.current.set(id, audioElement);
  }, []);

  const unregisterAudio = useCallback((id: string) => {
    audioMapRef.current.delete(id);
    if (currentPlayingIdRef.current === id) {
      currentPlayingIdRef.current = null;
    }
  }, []);

  const playAudio = useCallback((id: string) => {
    // Pausar o áudio atual se houver um diferente tocando
    if (currentPlayingIdRef.current && currentPlayingIdRef.current !== id) {
      const currentAudio = audioMapRef.current.get(currentPlayingIdRef.current);
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
      }
    }
    
    currentPlayingIdRef.current = id;
  }, []);

  const pauseAudio = useCallback((id: string) => {
    if (currentPlayingIdRef.current === id) {
      currentPlayingIdRef.current = null;
    }
  }, []);

  const getCurrentPlayingId = useCallback(() => {
    return currentPlayingIdRef.current;
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        registerAudio,
        unregisterAudio,
        playAudio,
        pauseAudio,
        getCurrentPlayingId,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}

// Hook opcional para componentes que podem estar fora do provider
export function useAudioPlayerOptional() {
  return useContext(AudioPlayerContext);
}
