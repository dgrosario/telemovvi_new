"use client";

import { assignConversation } from "@/app/actions/conversations";
import { getErrorMessage } from "@/lib/error-messages";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { useChat } from "./use-chat";
import { useConversationFilters } from "./conversation-filters-loader";
import { useUserSectors } from "./use-user-sectors";
import { useConversationStore } from "./use-conversation-store";

type SectorCheckResult = {
  needsSelection: boolean;
  autoSectorId?: string;
};

export function useAssignConversation() {
  const store = useChat();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const { setStatusFilters } = useConversationFilters();
  const { data: userSectors, isLoading: isSectorsLoading } = useUserSectors();

  const checkSectorSelection = useCallback(
    (conversationId: string): SectorCheckResult => {
      const conversation = store.conversations.get(conversationId);

      if (conversation?.sector) {
        return { needsSelection: false };
      }

      if (!userSectors || userSectors.length === 0) {
        return { needsSelection: false };
      }

      if (userSectors.length === 1) {
        return { needsSelection: false, autoSectorId: userSectors[0].id };
      }

      return { needsSelection: true };
    },
    [store.conversations, userSectors]
  );

  const assign = useCallback(
    async (conversationId: string, sectorId?: string) => {
      if (!store.user) {
        toast.error("Usuário não autenticado");
        return false;
      }

      const conversationSnapshot = store.conversations.get(conversationId);
      if (conversationSnapshot?.conversationType === "whatsapp-group") {
        toast.info("Grupos do WhatsApp não podem ter atendentes atribuídos");
        return false;
      }

      const sectorsSnapshot = userSectors;
      const isLoadingSnapshot = isSectorsLoading;

      if (sectorId && (isLoadingSnapshot || !sectorsSnapshot)) {
        toast.error("Aguarde o carregamento dos setores");
        return false;
      }

      setIsPending(true);

      const previousConversation = store.conversations.get(conversationId);

      const conversationStore = useConversationStore.getState();

      const selectedSector = sectorId
        ? sectorsSnapshot?.find((s) => s.id === sectorId)
        : undefined;

      if (sectorId && !selectedSector) {
        toast.error("Setor selecionado não encontrado");
        setIsPending(false);
        return false;
      }

      const updateStores = (conversation: Conversation.Raw) => {
        store.updateConversation(conversation);
        conversationStore.updateConversation(conversationId, conversation);
        queryClient.setQueryData(
          ["retrieve-conversation", conversationId],
          conversation
        );
      };

      const invalidateConversationsQueries = () => {
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "conversations-paginated",
        });
      };

      const invalidateConversationDetails = () => {
        queryClient.invalidateQueries({
          queryKey: ["retrieve-conversation", conversationId],
        });
      };

      let performedOptimisticUpdate = false;

      if (previousConversation) {
        const updatedConversation = {
          ...previousConversation.raw(),
          status: "open" as const,
          attendant: { id: store.user.id, name: store.user.name },
          openedAt: new Date(),
          ...(sectorId &&
            selectedSector && {
              sector: { id: selectedSector.id, name: selectedSector.name },
            }),
        };

        updateStores(updatedConversation);
        performedOptimisticUpdate = true;
      }

      try {
        const [result, error] = await assignConversation({
          conversationId,
          sectorId,
        });

        if (error) {
          if (performedOptimisticUpdate && previousConversation) {
            updateStores(previousConversation.raw());
          }
          invalidateConversationsQueries();
          invalidateConversationDetails();

          const { message, isConflict } = getErrorMessage(
            error,
            "Erro ao atender conversa"
          );

          if (isConflict) {
            toast.warning(message);
          } else {
            toast.error(message);
          }
          return false;
        }

        if (result?.conversation) {
          updateStores(result.conversation);
        } else {
          console.warn(
            "[useAssignConversation] Sucesso mas sem dados da conversa retornados"
          );
        }

        toast.success("Atendimento assumido com sucesso!");

        setStatusFilters(["open"]);

        invalidateConversationsQueries();

        store.setConversationOpenedId(conversationId);

        return true;
      } catch (error) {
        console.error("[useAssignConversation] Erro inesperado:", error);

        if (performedOptimisticUpdate && previousConversation) {
          updateStores(previousConversation.raw());
        }
        invalidateConversationsQueries();
        invalidateConversationDetails();

        toast.error("Erro ao atender conversa");
        return false;
      } finally {
        setIsPending(false);
      }
    },
    [store, queryClient, setStatusFilters, userSectors, isSectorsLoading]
  );

  return { assign, isPending, checkSectorSelection };
}
