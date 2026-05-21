"use client";

import { formatWindowTimeRemaining, TWENTY_FOUR_HOURS_MS, SEVEN_DAYS_MS } from "@/hooks/use-instagram-seven-day-window";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useEffect, useMemo, useState } from "react";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

type Props = {
  conversation: Conversation.Raw | undefined;
};

type ExpirationState = {
  isExpired: boolean;
  isHumanAgentWindow: boolean;
  isFullyExpired: boolean;
  timeRemaining: number;
  sevenDayTimeRemaining: number;
  showAlert: boolean;
  alertLevel: "info" | "warning" | "danger" | "expired";
};

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expirado";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getAlertLevel(timeRemaining: number): "info" | "warning" | "danger" | "expired" {
  if (timeRemaining <= 0) return "expired";
  if (timeRemaining <= ONE_HOUR_MS) return "danger";
  return "warning";
}

function getAlertStyles(level: "info" | "warning" | "danger" | "expired"): string {
  switch (level) {
    case "info":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "warning":
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    case "danger":
      return "bg-orange-50 border-orange-200 text-orange-800";
    case "expired":
      return "bg-red-50 border-red-200 text-red-800";
  }
}

function getIconStyles(level: "info" | "warning" | "danger" | "expired"): string {
  switch (level) {
    case "info":
      return "text-blue-500";
    case "warning":
      return "text-yellow-500";
    case "danger":
      return "text-orange-500";
    case "expired":
      return "text-red-500";
  }
}

export function InstagramExpirationAlert({ conversation }: Props) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const expirationState = useMemo((): ExpirationState | null => {
    if (!conversation) return null;
    if (conversation.channel?.type !== "instagram") return null;
    if (!conversation.lastClientMessageCreatedAt) return null;

    const lastMessageTime = new Date(
      conversation.lastClientMessageCreatedAt
    ).getTime();
    const expirationTime = lastMessageTime + TWENTY_FOUR_HOURS_MS;
    const sevenDayExpirationTime = lastMessageTime + SEVEN_DAYS_MS;
    const timeRemaining = expirationTime - currentTime;
    const sevenDayTimeRemaining = sevenDayExpirationTime - currentTime;
    const isExpired = timeRemaining <= 0;
    const isFullyExpired = sevenDayTimeRemaining <= 0;
    const isHumanAgentWindow = isExpired && !isFullyExpired;
    const showAlert = isHumanAgentWindow || isFullyExpired || timeRemaining <= TWO_HOURS_MS;

    if (isFullyExpired) {
      return {
        isExpired,
        isHumanAgentWindow: false,
        isFullyExpired: true,
        timeRemaining,
        sevenDayTimeRemaining: 0,
        showAlert: true,
        alertLevel: "expired",
      };
    }

    if (isHumanAgentWindow) {
      return {
        isExpired,
        isHumanAgentWindow: true,
        isFullyExpired: false,
        timeRemaining,
        sevenDayTimeRemaining,
        showAlert: true,
        alertLevel: "info",
      };
    }

    return {
      isExpired,
      isHumanAgentWindow: false,
      isFullyExpired: false,
      timeRemaining,
      sevenDayTimeRemaining,
      showAlert,
      alertLevel: getAlertLevel(timeRemaining),
    };
  }, [conversation, currentTime]);

  if (!expirationState || !expirationState.showAlert) {
    return null;
  }

  const { isExpired, isHumanAgentWindow, isFullyExpired, timeRemaining, sevenDayTimeRemaining, alertLevel } = expirationState;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 border rounded-lg mb-2 ${getAlertStyles(alertLevel)}`}
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 ${getIconStyles(alertLevel)}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <div className="flex-1 text-sm">
        {isFullyExpired ? (
          <span className="font-medium">
            Janela de 7 dias totalmente expirada. Aguarde nova mensagem do contato.
          </span>
        ) : isHumanAgentWindow ? (
          <span>
            <span className="font-medium">Instagram:</span> Janela padrão de 24h expirada. Mensagens serão enviadas com tag HUMAN_AGENT até o limite de 7 dias. Tempo restante:{" "}
            <span className="font-bold">{formatWindowTimeRemaining(sevenDayTimeRemaining)}</span>
          </span>
        ) : (
          <span>
            <span className="font-medium">Instagram:</span> Janela de 24h expira
            em <span className="font-bold">{formatTimeRemaining(timeRemaining)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function useInstagramExpiration(
  conversation: Conversation.Raw | undefined
): {
  isExpired: boolean;
  isHumanAgentWindow: boolean;
  isFullyExpired: boolean;
  canSendMessage: boolean;
  sevenDayTimeRemaining: number;
} {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const result = useMemo(() => {
    if (!conversation) {
      return { isExpired: false, isHumanAgentWindow: false, isFullyExpired: false, canSendMessage: false, sevenDayTimeRemaining: 0 };
    }

    if (conversation.channel?.type !== "instagram") {
      return { isExpired: false, isHumanAgentWindow: false, isFullyExpired: false, canSendMessage: true, sevenDayTimeRemaining: 0 };
    }

    if (!conversation.lastClientMessageCreatedAt) {
      return { isExpired: true, isHumanAgentWindow: false, isFullyExpired: true, canSendMessage: false, sevenDayTimeRemaining: 0 };
    }

    const lastMessageTime = new Date(
      conversation.lastClientMessageCreatedAt
    ).getTime();
    const expirationTime = lastMessageTime + TWENTY_FOUR_HOURS_MS;
    const sevenDayExpirationTime = lastMessageTime + SEVEN_DAYS_MS;
    const isExpired = currentTime >= expirationTime;
    const isFullyExpired = currentTime >= sevenDayExpirationTime;
    const isHumanAgentWindow = isExpired && !isFullyExpired;
    const sevenDayTimeRemaining = Math.max(sevenDayExpirationTime - currentTime, 0);

    return {
      isExpired,
      isHumanAgentWindow,
      isFullyExpired,
      canSendMessage: !isFullyExpired,
      sevenDayTimeRemaining,
    };
  }, [conversation, currentTime]);

  return result;
}
