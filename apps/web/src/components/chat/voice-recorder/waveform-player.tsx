import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../ui/button";
import { formatTime } from "@/lib/utils";
import { useAudioPlayerOptional } from "@/hooks/use-audio-player";

type Props = {
  blob: Blob;
};

export const WaveformPlayer: React.FC<Props> = ({ blob }) => {
  const audioPlayer = useAudioPlayerOptional();
  let animationPlayerFrameId: number;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const widthPerBar = useMemo(() => 4, []);
  const svgHeight = useMemo(() => 40, []);
  const barWidth = useMemo(() => 2, []);
  const samples = useMemo(
    () => Math.floor(containerWidth / widthPerBar) - 100,
    [containerWidth, widthPerBar]
  );
  const progressIndex = useMemo(
    () =>
      duration > 0
        ? Math.floor((currentTime / duration) * amplitudes.length)
        : 0,
    [duration, currentTime, amplitudes]
  );
  const audioId = useRef(`waveform-${Date.now()}`).current;

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [containerRef.current]);

  useEffect(() => {
    if (blob) {
      const audioURL = URL.createObjectURL(blob);
      const audio = new Audio(audioURL);
      audioRef.current = audio;

      // Registra no provider se disponível
      if (audioPlayer) {
        audioPlayer.registerAudio(audioId, audio);
      }

      // Listener para detectar quando o áudio é pausado externamente
      const onPause = () => {
        setIsPlaying(false);
      };

      audio.addEventListener("canplaythrough", () => handleReady());
      audio.addEventListener("pause", onPause);

      return () => {
        audio.pause();
        audio.src = "";
        audio.load();
        audio.removeEventListener("canplaythrough", () => handleReady());
        audio.removeEventListener("pause", onPause);
        if (audioPlayer) {
          audioPlayer.unregisterAudio(audioId);
        }
      };
    }
  }, [blob, audioId, audioPlayer]);

  useEffect(() => {
    if (ready) {
      createAmplitudesFromBlob();
    }
  }, [ready]);

  useEffect(() => {
    if (isPlaying) {
      animationPlayerFrameId = requestAnimationFrame(updatePlayer);
    }
    return () => cancelAnimationFrame(animationPlayerFrameId);
  }, [isPlaying]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, duration, ready]);

  const handleReady = () => {
    if (audioRef.current) {
      setReady(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleSeek(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const updatePlayer = () => {
    const endIn = duration - 0.06;
    if (endIn === audioRef.current?.currentTime) {
      setIsPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(animationPlayerFrameId);
      return;
    }
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      animationPlayerFrameId = requestAnimationFrame(updatePlayer);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const createAmplitudesFromBlob = async () => {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    setDuration(audioBuffer.duration);

    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const amps: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      amps.push(sum - 10);
    }

    setAmplitudes(amps);
  };

  const togglePlay = () => {
    if (!ready || !audioRef.current) return;

    if (audioRef.current.paused) {
      // Notifica o provider que este áudio vai tocar (pausa outros)
      if (audioPlayer) {
        audioPlayer.playAudio(audioId);
      }
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      if (audioPlayer) {
        audioPlayer.pauseAudio(audioId);
      }
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (clientX: number) => {
    if (!audioRef.current || !ready || duration === 0 || !isFinite(duration))
      return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = clientX - rect.left;
    const percent = Math.min(1, Math.max(0, clickX / rect.width));

    const newTime = percent * duration;
    if (!isFinite(newTime)) return;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div ref={containerRef} className="flex items-center w-full space-x-2">
      <Button
        type="button"
        variant="ghost"
        className="rounded-full"
        onClick={togglePlay}
      >
        <svg
          className="w-4 h-4 text-gray-800"
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

      <span className="w-10 select-none text-xs">
        {ready ? formatTime(isPlaying ? currentTime : duration) : "00:00"}
      </span>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${samples * widthPerBar} ${svgHeight}`}
        preserveAspectRatio="none"
        className="cursor-pointer w-full h-10"
        onMouseDown={handleMouseDown}
        xmlns="http://www.w3.org/2000/svg"
      >
        {amplitudes.map((amp, i) => {
          const height = Math.max(5, amp * svgHeight * 2);
          const x = i * widthPerBar;
          const centerY = svgHeight / 2;
          const y = centerY - height / 2;

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={10}
              fill={i <= progressIndex ? "#6B7280" : "#E5E7EB"}
            />
          );
        })}

        {ready && (
          <rect
            x={progressIndex * widthPerBar}
            y={svgHeight / 2 - 6}
            width={8}
            height={12}
            rx={4}
            fill="#1C64F2"
          />
        )}
      </svg>
    </div>
  );
};
