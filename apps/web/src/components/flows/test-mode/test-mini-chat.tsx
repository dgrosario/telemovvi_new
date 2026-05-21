"use client";

import { useEffect, useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useFlowTestStore } from "@/stores/flow-test-store";
import { TestMessageBubble } from "./test-message-bubble";
import { TestInputArea } from "./test-input-area";

interface TestMiniChatProps {
  onUserMessage: (message: string) => void;
  onStartWithMessage?: (message: string) => void;
}

export function TestMiniChat({ onUserMessage, onStartWithMessage }: TestMiniChatProps) {
  const { messages, awaitingUserInput, pendingMenuSelection, isExecuting } = useFlowTestStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOptionSelect = (value: string) => {
    if (awaitingUserInput && pendingMenuSelection) {
      onUserMessage(value);
    }
  };

  const handleSendMessage = (message: string) => {
    if (awaitingUserInput) {
      onUserMessage(message);
    } else if (!isExecuting && onStartWithMessage) {
      onStartWithMessage(message);
    }
  };

  const showInput = !pendingMenuSelection;

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {messages.length === 0 && !isExecuting && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", mt: 4 }}
          >
            Clique em &quot;Iniciar Teste&quot; para começar
          </Typography>
        )}

        {messages.map((message) => (
          <TestMessageBubble
            key={message.id}
            message={message}
            onOptionSelect={
              awaitingUserInput && message.metadata?.options
                ? handleOptionSelect
                : undefined
            }
          />
        ))}

        <div ref={messagesEndRef} />
      </Box>

      <TestInputArea
        onSend={handleSendMessage}
        disabled={!showInput}
        placeholder={
          !isExecuting
            ? "Digite uma mensagem para iniciar o teste..."
            : awaitingUserInput
              ? pendingMenuSelection
                ? "Selecione uma opção acima..."
                : "Digite sua resposta..."
              : "Aguardando fluxo..."
        }
      />
    </Stack>
  );
}
