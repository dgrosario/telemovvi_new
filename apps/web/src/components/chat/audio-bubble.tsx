"use client";
import { formatTime } from "@/lib/utils";
import { LinearProgress } from "@mui/material";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import React, { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "../ui/button";
import { MessageContainer } from "./message-container";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { MediaErrorState } from "./media-error-state";
import { useAudioPlayer } from "@/hooks/use-audio-player";

type MessageWithError = Message.Raw & { error?: boolean };

type Props = {
  message: MessageWithError;
  channel: string;
  hiddenAvatar: boolean;
  channelType?: Channel.Type;
  channelName?: string;
  isWhatsAppGroup?: boolean;
  currentUserId?: string;
  conversationType?: string;
  conversationStatus?: string | null;
  isAdmin?: boolean;
  onDelete?: () => void;
  onReply?: () => void;
  isDeleting?: boolean;
  quotedMessageId?: string | null;
  messages?: Map<string, Message>;
  conversationId?: string;
  originalContent?: string | null;
  onViewHistory?: () => void;
  isHistoryExpanded?: boolean;
  isStarred?: boolean;
  onToggleStar?: () => void;
  isTogglingStarred?: boolean;
  reactions?: Message.Reaction[];
  onToggleReaction?: (emoji: string) => void;
};

export const AudioBubble: React.FC<Props> = memo(function AudioBubble(props) {
  if (props.message?.type !== "audio") return <></>;

  const { registerAudio, unregisterAudio, playAudio, pauseAudio } = useAudioPlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const isSeekingRef = useRef(false);
  const durationRef = useRef(0);
  const seekTimeRef = useRef(0);
  
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const audioId = props.message.id;

  const barWidth = 3;
  const barGap = 2;
  const barCount = useMemo(() => {
    if (containerWidth === 0) return 20;
    return Math.floor(containerWidth / (barWidth + barGap));
  }, [containerWidth]);

  const progressIndex = useMemo(() => {
    if (duration <= 0 || amplitudes.length === 0) return 0;
    return Math.floor((currentTime / duration) * amplitudes.length);
  }, [duration, currentTime, amplitudes]);

  const maxAmplitude = useMemo(
    () => (amplitudes.length > 0 ? Math.max(...amplitudes) : 1),
    [amplitudes]
  );

  // Atualiza ref quando duration muda
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Intersection Observer para lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Observar tamanho do container
  useEffect(() => {
    if (loading) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });

    if (waveformRef.current) {
      resizeObserver.observe(waveformRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [loading]);

  // Carregar áudio quando visível
  useEffect(() => {
    if (!isVisible || !props.channel) return;

    const audio = new Audio(
      `/api/message/${props.message.id}/media?channelId=${props.channel}`
    );
    audioRef.current = audio;
    registerAudio(audioId, audio);

    const onTimeUpdate = () => {
      if (!isSeekingRef.current && audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const onEnded = () => {
      if (isSeekingRef.current) {
        return;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
      pauseAudio(audioId);
    };

    const onPause = () => {
      if (!isSeekingRef.current) {
        setIsPlaying(false);
      }
    };
    
    const onPlay = () => {
      setIsPlaying(true);
    };

    const onCanPlayThrough = () => {
      loadWaveform();
    };

    const onError = () => {
      console.error("[AudioBubble] Failed to load audio:", props.message.id);
      setLoading(false);
      setHasError(true);
    };

    audio.addEventListener("canplaythrough", onCanPlayThrough);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("canplaythrough", onCanPlayThrough);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("error", onError);
      unregisterAudio(audioId);
    };
  }, [isVisible, props.channel, props.message.id, audioId]);

  const loadWaveform = async () => {
    if (!audioRef.current) return;
    
    let audioContext: AudioContext | null = null;
    try {
      const response = await fetch(audioRef.current.src);
      if (!response.ok) {
        setLoading(false);
        setHasError(true);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const audioDuration = audioBuffer.duration;
      setDuration(audioDuration);
      durationRef.current = audioDuration;

      const rawData = audioBuffer.getChannelData(0);
      const samples = Math.max(barCount, 20);
      const blockSize = Math.floor(rawData.length / samples);
      const amps: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        amps.push(sum / blockSize);
      }

      setAmplitudes(amps);
      setLoading(false);
    } catch (error) {
      console.error("[AudioBubble] Error processing audio:", error);
      setLoading(false);
      setHasError(true);
    } finally {
      if (audioContext) {
        await audioContext.close();
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      playAudio(audioId);
      audioRef.current.play();
    } else {
      pauseAudio(audioId);
      audioRef.current.pause();
    }
  };

  // Calcula o tempo baseado na posição X do mouse/touch
  const getTimeFromPosition = useCallback((clientX: number): number => {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect || durationRef.current <= 0) return 0;

    const x = clientX - rect.left;
    const percent = Math.min(1, Math.max(0, x / rect.width));
    return percent * durationRef.current;
  }, []);

  // Handlers de mouse
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    
    const wasPlaying = !audioRef.current.paused;
    
    // Marca como seeking ANTES de pausar
    isSeekingRef.current = true;
    
    if (wasPlaying) {
      audioRef.current.pause();
    }
    
    const time = getTimeFromPosition(e.clientX);
    seekTimeRef.current = time;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isSeekingRef.current && audioRef.current) {
        const newTime = getTimeFromPosition(moveEvent.clientX);
        seekTimeRef.current = newTime;
      }
    };

    const handleMouseUp = () => {
      if (audioRef.current) {
        const targetTime = seekTimeRef.current;
        const audioElement = audioRef.current;
        
        // Tenta o set
        audioElement.currentTime = targetTime;
        
        // Se o set falhou, tenta recarregar o áudio
        if (Math.abs(audioElement.currentTime - targetTime) > 0.1) {
          audioElement.load();
          
          const onCanPlay = () => {
            audioElement.currentTime = targetTime;
            isSeekingRef.current = false;
            setCurrentTime(targetTime);
            
            if (wasPlaying) {
              playAudio(audioId);
              audioElement.play().catch(err => {
                console.error('[AudioBubble] play error:', err);
              });
            }
            
            audioElement.removeEventListener('canplay', onCanPlay);
          };
          
          audioElement.addEventListener('canplay', onCanPlay);
        } else {
          // Seek funcionou normalmente
          isSeekingRef.current = false;
          setCurrentTime(targetTime);
          
          if (wasPlaying) {
            playAudio(audioId);
            audioElement.play().catch(err => {
              console.error('[AudioBubble] play error:', err);
            });
          }
        }
      } else {
        isSeekingRef.current = false;
      }
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getTimeFromPosition, audioId, playAudio]);

  // Handlers de touch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!e.touches[0] || !audioRef.current) return;
    
    const wasPlaying = !audioRef.current.paused;
    
    if (wasPlaying) {
      audioRef.current.pause();
    }
    
    isSeekingRef.current = true;
    const time = getTimeFromPosition(e.touches[0].clientX);
    seekTimeRef.current = time;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (isSeekingRef.current && moveEvent.touches[0] && audioRef.current) {
        moveEvent.preventDefault();
        const newTime = getTimeFromPosition(moveEvent.touches[0].clientX);
        seekTimeRef.current = newTime;
      }
    };

    const handleTouchEnd = () => {
      if (audioRef.current) {
        const targetTime = seekTimeRef.current;
        const audioElement = audioRef.current;
        
        audioElement.currentTime = targetTime;
        
        if (Math.abs(audioElement.currentTime - targetTime) > 0.1) {
          audioElement.load();
          
          const onCanPlay = () => {
            audioElement.currentTime = targetTime;
            isSeekingRef.current = false;
            setCurrentTime(targetTime);
            
            if (wasPlaying) {
              playAudio(audioId);
              audioElement.play().catch(err => {
                console.error('[AudioBubble] play error:', err);
              });
            }
            
            audioElement.removeEventListener('canplay', onCanPlay);
          };
          
          audioElement.addEventListener('canplay', onCanPlay);
        } else {
          isSeekingRef.current = false;
          setCurrentTime(targetTime);
          
          if (wasPlaying) {
            playAudio(audioId);
            audioElement.play().catch(err => {
              console.error('[AudioBubble] play error:', err);
            });
          }
        }
      } else {
        isSeekingRef.current = false;
      }
      
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  }, [getTimeFromPosition, audioId, playAudio]);

  return (
    <MessageContainer
      createdAt={props.message.createdAt}
      senderType={props.message.sender?.type}
      status={props.message.status}
      error={props.message.error}
      hiddenAvatar={props.hiddenAvatar}
      senderName={props.message.sender.name}
      senderId={props.message.sender.id}
      ref={containerRef}
      channelType={props.channelType}
      channelName={props.channelName}
      isWhatsAppGroup={props.isWhatsAppGroup}
      currentUserId={props.currentUserId}
      messageId={props.message.id}
      messageContent={props.message.content}
      deletedAt={props.message.deletedAt}
      onDelete={props.onDelete}
      onReply={props.onReply}
      isDeleting={props.isDeleting}
      conversationType={props.conversationType}
      conversationStatus={props.conversationStatus}
      isAdmin={props.isAdmin}
      editedAt={props.message.editedAt}
      originalContent={props.originalContent}
      onViewHistory={props.onViewHistory}
      isHistoryExpanded={props.isHistoryExpanded}
      isStarred={props.isStarred}
      onToggleStar={props.onToggleStar}
      isTogglingStarred={props.isTogglingStarred}
      reactions={props.reactions}
      onToggleReaction={props.onToggleReaction}
    >
      {props.quotedMessageId && props.messages && (
        <QuotedMessagePreview
          quotedMessageId={props.quotedMessageId}
          messages={props.messages}
          conversationId={props.conversationId}
        />
      )}
      <div className="px-3 pt-4 pb-1 w-full min-w-[180px] max-w-full">
        {loading && (
          <div className="w-full gap-4 flex justify-center items-center py-2">
            <LinearProgress className="w-full rounded" />
          </div>
        )}
        
        {!loading && hasError && (
          <MediaErrorState type="audio" compact isInstagram={props.channelType === "instagram"} />
        )}
        
        {!loading && !hasError && (
          <div className="flex items-center gap-2 w-full">
            {/* Botão Play/Pause */}
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 size-9 rounded-full bg-primary/10 hover:bg-primary/20 p-0"
              onClick={togglePlay}
            >
              <svg
                className="size-4 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 12 16"
              >
                {isPlaying ? (
                  <path d="M3 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm7 0H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Z" />
                ) : (
                  <path d="M2 0v16l12-8L2 0z" />
                )}
              </svg>
            </Button>

            {/* Waveform e tempo */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              {/* Waveform clicável */}
              <div
                ref={waveformRef}
                className="relative h-10 flex items-center cursor-pointer select-none"
                style={{ touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <div className="flex items-center gap-[2px] w-full h-full overflow-hidden">
                  {amplitudes.map((amp, i) => {
                    const normalizedHeight = Math.max(4, (amp / maxAmplitude) * 32);
                    const isProgressed = i <= progressIndex;
                    
                    return (
                      <div
                        key={i}
                        className={`rounded-full ${
                          isProgressed ? 'bg-primary' : 'bg-gray-400'
                        }`}
                        style={{
                          width: `${barWidth}px`,
                          height: `${normalizedHeight}px`,
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        )}
      </div>
    </MessageContainer>
  );
});
