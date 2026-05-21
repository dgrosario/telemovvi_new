"use client";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { Tooltip } from "@mui/material";
import { Mic, Send, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/button";
import { WaveformPlayer } from "./waveform-player";
import { WaveformRecorder } from "./waveform-recording";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { sendMedia } from "@/app/actions/messages";
import { useChat } from "@/hooks/use-chat";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Attendant } from "@omnichannel/core/domain/entities/attendant";
import { Message } from "@omnichannel/core/domain/entities/message";
import { toast } from "react-toastify";
import {
  validateMessageForChannel,
  validateMimeTypeForChannel,
} from "@/lib/channel-capabilities";

type Props = {
  setStateRecording(state: boolean): void;
  disabled?: boolean;
  conversation?: Conversation.Raw;
  hidden?: boolean;
  unsupportedMessage?: string;
};

export const VoiceRecorder: React.FC<Props> = (props) => {
  const store = useChat();
  const pendingMessageIdRef = useRef<string | null>(null);
  const sendMediaAction = useServerActionMutation(sendMedia, {
    onError(error) {
      toast.error(error.message);
      if (pendingMessageIdRef.current) {
        store.markMessageAsError(pendingMessageIdRef.current);
      }
    },
  });
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob>();
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | number>(0);
  const ffmpegRef = useRef(new FFmpeg());

  useEffect(() => {
    const load = async () => {
      const ffmpeg = ffmpegRef.current;
      try {
        if (!ffmpeg.loaded) {
          await ffmpeg.load();
        }
        setFfmpegLoaded(true);
      } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        setFfmpegError("Codificador de áudio indisponível");
      }
    };
    load();
  }, []);

  useEffect(() => {
    props.setStateRecording(recording);
  }, [recording, props.setStateRecording]);

  useEffect(() => {
    return () => {
      clearTimeout(pressTimer.current);
      if (mediaRecorder.current?.state === "recording") {
        mediaRecorder.current.onstop = null;
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const stopVisuals = () => {
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error("Failed to access microphone:", error);
      toast.error("Não foi possível acessar o microfone");
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunks.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    recorder.onstop = async () => {
      const ffmpeg = ffmpegRef.current;

      if (!ffmpeg.loaded) {
        toast.error("Codificador de áudio não carregado. Tente novamente.");
        handleCancel();
        return;
      }

      try {
        const mimeType = "audio/webm";
        const rawBlob = new Blob(chunks.current, { type: mimeType });

        await ffmpeg.writeFile("input.webm", await fetchFile(rawBlob));
        // Keep output in OGG/Opus mono at 16kHz to maximize Meta compatibility.
        await ffmpeg.exec([
          "-i",
          "input.webm",
          "-vn",
          "-c:a",
          "libopus",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-b:a",
          "32k",
          "-application",
          "voip",
          "-f",
          "ogg",
          "output.ogg",
        ]);

        const data = await ffmpeg.readFile("output.ogg");

        try {
          await ffmpeg.deleteFile("input.webm");
          await ffmpeg.deleteFile("output.ogg");
        } catch {
          // Ignora erro de limpeza
        }

        if (!data || (data instanceof Uint8Array && data.length === 0)) {
          throw new Error("Arquivo de áudio vazio após conversão");
        }

        const blobData = data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data);
        const convertedBlob = new Blob([blobData], { type: "audio/ogg" });

        const file = new File([convertedBlob], "recording.ogg", {
          type: "audio/ogg",
        });

        if (file.size === 0) {
          throw new Error("Arquivo de áudio vazio após conversão");
        }

        const channelType = props.conversation?.channel?.type;
        const sizeValidation = validateMessageForChannel(
          channelType,
          "audio",
          file.size,
        );
        if (sizeValidation) {
          toast.error(sizeValidation.message);
          handleCancel();
          return;
        }

        const mimeValidation = validateMimeTypeForChannel(
          channelType,
          "audio",
          file.type,
        );
        if (mimeValidation) {
          toast.error(mimeValidation.message);
          handleCancel();
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const url = URL.createObjectURL(convertedBlob);
        objectUrlRef.current = url;
        const messageId = crypto.randomUUID().toString();

        if (!store.user?.id || !store.user?.name) {
          throw new Error("Usuário não autenticado");
        }

        if (!props.conversation?.id || !props.conversation?.channel?.id) {
          throw new Error("Conversa não selecionada");
        }

        const message = Message.create({
          content: url,
          createdAt: new Date(),
          id: messageId,
          sender: Attendant.create({
            id: store.user.id,
            name: store.user.name,
          }),
          type: "audio",
          filename: "recording.ogg",
          mimetype: "audio/ogg",
        });

        store.addMessage(message);
        pendingMessageIdRef.current = messageId;

        setBlob(convertedBlob);
        sendMediaAction.mutate({
          file,
          conversationId: props.conversation.id,
          channelId: props.conversation.channel.id,
          type: "audio",
          correlationId: messageId,
        });
      } catch (error) {
        console.error("Audio conversion failed:", error);
        toast.error("Erro ao processar áudio. Tente novamente.");
        handleCancel();
      }
    };

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    recorder.start();
    mediaRecorder.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
    stopVisuals();
  };

  const handleStart = () => {
    pressTimer.current = setTimeout(() => {
      startRecording();
    }, 500);
  };

  const handleSend = () => {
    clearTimeout(pressTimer.current);
    stopRecording();
    setBlob(undefined);
  };

  const handleCancel = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
    setBlob(undefined);
    stopVisuals();
    chunks.current = [];
  };

  if (!recording) {
    const isDisabled = props.disabled || !ffmpegLoaded || !!ffmpegError;
    const tooltipMessage = ffmpegError || props.unsupportedMessage;

    const button = (
      <Button
        disabled={isDisabled}
        className={`rounded-full w-10 p-1 h-10 transition-all duration-200 ${
          props.hidden
            ? "opacity-0 scale-75 pointer-events-none absolute right-3"
            : "opacity-100 scale-100"
        } ${tooltipMessage ? "opacity-50" : ""}`}
        variant="ghost"
        type="button"
        onClick={handleStart}
      >
        <Mic className={`size-5 ${tooltipMessage ? "stroke-gray-400" : "stroke-[#0A0A0A]"}`} />
      </Button>
    );

    if (tooltipMessage) {
      return (
        <Tooltip title={tooltipMessage} placement="top">
          <span className={props.hidden ? "absolute right-3" : ""}>{button}</span>
        </Tooltip>
      );
    }

    return button;
  }

  return (
    <div className="flex items-center space-x-2 w-full animate-in slide-in-from-left duration-300">
      <Button
        className="rounded-full w-10 h-10 p-2 transition-all hover:scale-110 active:scale-95"
        variant="ghost"
        type="button"
        onClick={handleCancel}
      >
        <Trash2 className="size-5 stroke-1 stroke-red-500" />
      </Button>
      <div className="w-full h-screen max-h-10 border rounded-full pl-0 pr-4 flex gap-4">
        {recording && <WaveformRecorder analyserNode={analyserRef.current} />}
        {blob && !recording && <WaveformPlayer blob={blob} />}
      </div>
      <Button
        className="rounded-full w-10 h-10 p-2 bg-primary hover:bg-primary/90 transition-all hover:scale-110 active:scale-95"
        variant="ghost"
        type="button"
        onClick={handleSend}
      >
        <Send className="size-5 rotate-45 stroke-1 fill-white stroke-primary -translate-x-0.5" />
      </Button>
    </div>
  );
};
