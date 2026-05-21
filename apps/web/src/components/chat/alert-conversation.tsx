"use client";
import {
  assignConversation,
  requestTransfer,
  transferConversation,
} from "@/app/actions/conversations";
import { listCurrentUserSectors } from "@/app/actions/sectors";
import { getCurrentMembership } from "@/app/actions/users";
import { listChannels } from "@/app/actions/channels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { useConversationStore } from "@/hooks/use-conversation-store";
import { useConversationFilters } from "@/hooks/conversation-filters-loader";
import { useUserPermissions } from "@/providers/user-permissions-provider";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Typography } from "@mui/material";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { SendTemplateModal } from "./send-template-modal";

type Props = {
  isLoading: boolean;
  conversation?: Conversation.Raw;
};

export const AlertConversation: React.FC<Props> = ({
  isLoading,
  conversation,
}) => {
  const { conversationOpenedId, user } = useChat();
  const queryClient = useQueryClient();
  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const { setStatusFilters } = useConversationFilters();
  const { canViewContactDetailsForSector } = useUserPermissions();

  const { data: membership } = useServerActionQuery(getCurrentMembership, {
    queryKey: ["current-membership"],
    input: undefined,
  });

  const { data: mySectors = [] } = useServerActionQuery(listCurrentUserSectors, {
    queryKey: ["current-user-sectors"],
    input: undefined,
  });
  const isWhatsAppGroup = conversation?.conversationType === "whatsapp-group";

  // Usar todos os setores do usuário (igual ao comportamento do desktop/sidebar)
  const availableSectors = mySectors;

  const conversationSectorId = conversation?.sector?.id ?? "";
  const isCurrentSectorBlockedForContactDetails = useMemo(() => {
    if (!conversationSectorId) return false;
    return !canViewContactDetailsForSector(conversationSectorId);
  }, [conversationSectorId, canViewContactDetailsForSector]);
  const shouldLockSectorChangeOnTakeover =
    !!conversationSectorId && isCurrentSectorBlockedForContactDetails;
  const restrictedSectorSwapMessage =
    "Você não pode alterar o setor desta conversa ao assumir, pois o setor atual possui restrição de visualização de dados para seu usuário.";
  const userBelongsToConversationSector = conversationSectorId
    ? availableSectors.some((s) => s.id === conversationSectorId)
    : false;

  const normalizeSectorIdForTakeover = (sectorId?: string) => {
    if (!shouldLockSectorChangeOnTakeover || !conversationSectorId) {
      return { ok: true as const, sectorId };
    }

    if (sectorId && sectorId !== conversationSectorId) {
      return { ok: false as const, sectorId };
    }

    return { ok: true as const, sectorId: conversationSectorId };
  };

  useEffect(() => {
    if (shouldLockSectorChangeOnTakeover && conversationSectorId) {
      setSelectedSectorId(conversationSectorId);
      return;
    }

    if (userBelongsToConversationSector) {
      setSelectedSectorId(conversationSectorId);
    } else {
      setSelectedSectorId("");
    }
  }, [
    conversationSectorId,
    userBelongsToConversationSector,
    shouldLockSectorChangeOnTakeover,
  ]);

  const { data: channels = [] } = useServerActionQuery(listChannels, {
    input: {},
    queryKey: ["list-channels-for-expired"],
    enabled: conversation?.status === "expired",
  });

  const canTransferDirectly = membership?.canTransferDirectly ?? false;

  const assignConversationAction = useServerActionMutation(assignConversation, {
    onSuccess: async (data) => {
      toast.success("Atendimento assumido com sucesso!");

      if (data?.conversation) {
        const conversationStore = useConversationStore.getState();
        conversationStore.updateConversation(data.conversation.id, data.conversation);

        queryClient.setQueryData(
          ["retrieve-conversation", data.conversation.id],
          data.conversation
        );
      }

      setStatusFilters(["open"]);

      queryClient.invalidateQueries({
        queryKey: ["conversations-paginated"],
      });
      setDialogOpen(false);
    },
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao assumir atendimento");
    },
  });

  const requestTransferAction = useServerActionMutation(requestTransfer, {
    onSuccess: async () => {
      toast.success("Solicitação de transferência enviada com sucesso!");
      setDialogOpen(false);
    },
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao solicitar transferência");
    },
  });

  const transferConversationAction = useServerActionMutation(
    transferConversation,
    {
      onSuccess: async (data) => {
        toast.success("Atendimento transferido com sucesso!");

        if (data?.conversation) {
          const conversationStore = useConversationStore.getState();
          conversationStore.updateConversation(data.conversation.id, data.conversation);

          queryClient.setQueryData(
            ["retrieve-conversation", data.conversation.id],
            data.conversation
          );
        }

        setStatusFilters(["open"]);

        queryClient.invalidateQueries({
          queryKey: ["conversations-paginated"],
        });
        setDialogOpen(false);
      },
      onError: (err) => {
        toast.error((err as Error).message || "Erro ao transferir atendimento");
      },
    }
  );

  const status = useMemo(() => {
    if (
      assignConversationAction.isPending ||
      requestTransferAction.isPending ||
      transferConversationAction.isPending
    )
      return "TRANSFERING";
    
    // Se já é o atendente, não mostrar nenhum status
    if (conversation?.attendant?.id === user?.id) {
      return undefined;
    }

    if (isWhatsAppGroup) {
      return undefined;
    }
    
    if (!conversation?.attendant) return "WATING";
    if (
      conversation?.attendant?.id !== user?.id &&
      conversation.status === "open"
    )
      return "IN_CONVERSATION_WITH_OTHER_ATTENDANT";
  }, [
    assignConversationAction.isPending,
    requestTransferAction.isPending,
    transferConversationAction.isPending,
    conversation,
    isWhatsAppGroup,
    user?.id,
  ]);

  const alertText = useMemo(() => {
    const contents = new Map<typeof status, string | ReactNode>([
      [
        "TRANSFERING",
        "Você não é responsável pelo atendimento, não pode responder nesse chat.",
      ],
      [
        "IN_CONVERSATION_WITH_OTHER_ATTENDANT",
        <>
          Esse atendimento está sob a responsabilidade do atendente{" "}
          <b>{conversation?.attendant?.name}</b>.{" "}
          {canTransferDirectly
            ? "Você pode assumir este atendimento."
            : "Solicite a transferência para começar a responder nesse chat."}
        </>,
      ],
      [
        "WATING",
        "Você não é responsável pelo atendimento, não pode responder nesse chat.",
      ],
    ]);
    return contents.get(status);
  }, [status, conversation?.attendant?.name, canTransferDirectly]);

  const buttonTextAction = useMemo(() => {
    const contents = new Map<typeof status, string | ReactNode>([
      ["TRANSFERING", "Processando..."],
      [
        "IN_CONVERSATION_WITH_OTHER_ATTENDANT",
        canTransferDirectly ? "Assumir atendimento" : "Solicitar transferência",
      ],
      ["WATING", "Assumir atendimento"],
    ]);
    return contents.get(status);
  }, [status, canTransferDirectly]);

  const titleDialog = useMemo(() => {
    const contents = new Map<typeof status, string | ReactNode>([
      ["TRANSFERING", "Assumir atendimento?"],
      [
        "IN_CONVERSATION_WITH_OTHER_ATTENDANT",
        canTransferDirectly ? "Assumir atendimento?" : "Solicitar transferência?",
      ],
      ["WATING", "Assumir atendimento?"],
    ]);
    return contents.get(status);
  }, [status, canTransferDirectly]);

  const contentDialog = useMemo(() => {
    const contents = new Map<typeof status, string | ReactNode>([
      [
        "TRANSFERING",
        "Você será o responsável por este atendimento.",
      ],
      [
        "IN_CONVERSATION_WITH_OTHER_ATTENDANT",
        canTransferDirectly
          ? "O atendente atual será notificado."
          : "O atendente atual precisará aprovar.",
      ],
      [
        "WATING",
        "Você será o responsável por este atendimento.",
      ],
    ]);
    return contents.get(status);
  }, [status, canTransferDirectly]);

  const severity = useMemo(() => {
    const contents = new Map<
      typeof status,
      "warning" | "info" | "error" | "success"
    >([
      ["TRANSFERING", "warning"],
      ["IN_CONVERSATION_WITH_OTHER_ATTENDANT", "info"],
      ["WATING", "warning"],
    ]);
    return contents.get(status);
  }, [status]);

  // Verifica se precisa mostrar seletor de setor para status WATING também
  const needsSectorForWaiting = useMemo(() => {
    if (status !== "WATING") return false;
    if (!availableSectors || availableSectors.length <= 1) return false;
    return true;
  }, [status, availableSectors]);

  const handleProceed = () => {
    if (status === "WATING") {
      // Se precisa selecionar setor e não selecionou
      if (needsSectorForWaiting && !selectedSectorId) {
        toast.error("Selecione um setor");
        return;
      }
      
      let sectorId: string | undefined;
      if (availableSectors.length === 1) {
        sectorId = availableSectors[0].id;
      } else if (selectedSectorId) {
        sectorId = selectedSectorId;
      } else if (conversation?.sector) {
        sectorId = conversation.sector.id;
      }

      const normalizedSector = normalizeSectorIdForTakeover(sectorId);
      if (!normalizedSector.ok) {
        toast.error(restrictedSectorSwapMessage);
        return;
      }
      if (!normalizedSector.sectorId) {
        toast.error("Selecione um setor");
        return;
      }
      sectorId = normalizedSector.sectorId;
      
      assignConversationAction.mutate({
        conversationId: conversation?.id!,
        sectorId,
      });
    } else if (status === "IN_CONVERSATION_WITH_OTHER_ATTENDANT") {
      // Determinar sectorId baseado nos setores disponíveis
      let sectorId: string | undefined;
      if (availableSectors.length === 0) {
        // Usuário sem setores não pode assumir/solicitar transferência
        toast.error("Você não possui setores atribuídos para solicitar transferência");
        return;
      } else if (availableSectors.length === 1) {
        sectorId = availableSectors[0].id;
      } else {
        sectorId = selectedSectorId;
      }

      if (!sectorId) {
        toast.error("Selecione um setor");
        return;
      }

      const normalizedSector = normalizeSectorIdForTakeover(sectorId);
      if (!normalizedSector.ok) {
        toast.error(restrictedSectorSwapMessage);
        return;
      }
      if (!normalizedSector.sectorId) {
        toast.error("Selecione um setor");
        return;
      }
      sectorId = normalizedSector.sectorId;

      if (canTransferDirectly) {
        transferConversationAction.mutate({
          conversationId: conversation?.id!,
          sectorId,
          attendantId: user?.id,
        });
      } else {
        requestTransferAction.mutate({
          conversationId: conversation?.id!,
          sectorId,
        });
      }
    }
  };

  const showSectorSelector =
    (status === "IN_CONVERSATION_WITH_OTHER_ATTENDANT" && availableSectors.length > 1) ||
    needsSectorForWaiting;

  // IMPORTANTE: Todos os hooks devem vir ANTES de qualquer return condicional
  // Verificar se a conversa está expirada e se é um canal da API oficial (com wabaId)
  const isExpired = conversation?.status === "expired";
  const isOfficialApiChannel = useMemo(() => {
    if (!conversation?.channel || !isExpired) return false;
    
    const channelId = conversation.channel.id;
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return false;
    
    const channelType = channel.type;
    const payload = channel.payload;
    
    // Apenas canais com wabaId são da API oficial
    if (channelType === "meta_api") {
      return payload && typeof payload === "object" && "wabaId" in payload && !!payload.wabaId;
    }
    
    if (channelType === "whatsapp") {
      return payload && typeof payload === "object" && "wabaId" in payload && !!payload.wabaId;
    }
    
    // Evolution sem wabaId não é API oficial
    return false;
  }, [conversation?.channel, isExpired, channels]);

  // Early returns DEPOIS de todos os hooks
  if (isLoading) return <></>;
  if (isWhatsAppGroup) return null;

  // Regras específicas por canal e status
  const channelType = conversation?.channel?.type;
  const isClosed = conversation?.status === "closed";

  // 1. WhatsApp Cloud EXPIRED: Só pode enviar template
  if (isExpired && isOfficialApiChannel) {
    return (
      <>
        <Alert
          severity="warning"
          variant="filled"
          className="gap-4 absolute top-0 w-full z-50 flex flex-row"
          sx={{
            opacity: 0.65,
            alignItems: "center",
            "& .MuiAlert-icon": {
              alignItems: "center",
            },
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Typography variant="body2" sx={{ color: "inherit", fontWeight: 500 }}>
              Atendimento expirado (WhatsApp Cloud). Envie um template para reabrir a conversa.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setTemplateModalOpen(true)}
              sx={{
                color: "inherit",
                borderColor: "currentColor",
                "&:hover": {
                  borderColor: "currentColor",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
              }}
            >
              Enviar Template
            </Button>
          </div>
        </Alert>
        <SendTemplateModal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          conversation={conversation}
        />
      </>
    );
  }

  // 2. Instagram EXPIRED: Não pode enviar mensagem, mas pode transferir
  if (isExpired && channelType === "instagram") {
    return (
      <Alert
        severity="warning"
        variant="filled"
        className="gap-4 absolute top-0 w-full z-50 flex flex-row"
        sx={{
          opacity: 0.65,
          alignItems: "center",
          "& .MuiAlert-icon": {
            alignItems: "center",
          },
        }}
      >
        <div className="flex items-center gap-2">
          <Typography variant="body2" sx={{ color: "inherit", fontWeight: 500 }}>
            Atendimento expirado (Instagram). Não é possível enviar mensagens. Aguarde nova mensagem do cliente ou transfira para outro setor.
          </Typography>
        </div>
      </Alert>
    );
  }

  // 3. Evolution EXPIRED: Pode enviar mensagem e transferir normalmente (não bloqueia)
  // Não mostra alerta, deixa o usuário enviar mensagem normalmente

  // 4. Qualquer canal CLOSED: Pode reabrir assumindo novamente
  if (isClosed) {
    return (
      <Alert
        severity="info"
        variant="filled"
        className="gap-4 absolute top-0 w-full z-50 flex flex-row"
        sx={{
          opacity: 0.65,
          alignItems: "center",
          "& .MuiAlert-message": {
            width: "100%",
          },
          "& .MuiAlert-icon": {
            alignItems: "center",
          },
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Typography variant="body2" sx={{ color: "inherit", fontWeight: 500 }}>
            Esse atendimento foi encerrado. Você pode reabri-lo assumindo novamente.
          </Typography>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outlined"
                size="small"
                sx={{
                  color: "inherit",
                  borderColor: "currentColor",
                  "&:hover": {
                    borderColor: "currentColor",
                    backgroundColor: "rgba(255,255,255,0.1)",
                  },
                }}
              >
                Reabrir Atendimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[320px] p-4">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-base">Reabrir atendimento?</DialogTitle>
                <DialogDescription className="text-sm">
                  Você será o responsável por este atendimento.
                </DialogDescription>
              </DialogHeader>

              {availableSectors.length > 1 ? (
                <div className="py-2">
                  <select
                    id="sector-select"
                    value={selectedSectorId}
                    onChange={(e) => setSelectedSectorId(e.target.value)}
                    disabled={shouldLockSectorChangeOnTakeover}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Selecione um setor</option>
                    {shouldLockSectorChangeOnTakeover &&
                      conversation?.sector &&
                      !availableSectors.some((sector) => sector.id === conversation.sector?.id) && (
                        <option value={conversation.sector.id}>
                          {conversation.sector.name}
                        </option>
                      )}
                    {availableSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : availableSectors.length === 0 ? (
                <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md border border-amber-200">
                  Você não possui setores atribuídos. A conversa será reaberta sem setor definido.
                </div>
              ) : null}

              <DialogFooter className="pt-2 gap-2">
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    // Validar setor se necessário (apenas se tiver mais de um disponível)
                    if (availableSectors.length > 1 && !selectedSectorId) {
                      toast.error("Selecione um setor");
                      return;
                    }

                    // Determinar sectorId: undefined se não há setores, único setor se só tem um, ou selecionado
                    const sectorId = availableSectors.length === 0
                      ? undefined
                      : availableSectors.length === 1
                        ? availableSectors[0].id
                        : selectedSectorId || undefined;

                    const normalizedSector = normalizeSectorIdForTakeover(sectorId);
                    if (!normalizedSector.ok) {
                      toast.error(restrictedSectorSwapMessage);
                      return;
                    }

                    assignConversationAction.mutate({
                      conversationId: conversation?.id!,
                      sectorId: normalizedSector.sectorId,
                    });
                  }}
                  variant="contained"
                  size="small"
                >
                  Reabrir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Alert>
    );
  }

  const isInternalOrWhatsAppGroup =
    conversation?.conversationType === "direct" ||
    conversation?.conversationType === "group" ||
    conversation?.conversationType === "whatsapp-group";

  if (isInternalOrWhatsAppGroup) return null;

  if (!status) return null;

  return (
    <Alert
      severity={severity}
      variant="filled"
      className="gap-4 absolute top-0 w-full z-50 flex flex-row"
      sx={{
        opacity: 0.65,
        alignItems: "center",
        "& .MuiAlert-message": {
          width: "100%",
        },
        "& .MuiAlert-icon": {
          alignItems: "center",
        },
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Typography variant="body2" sx={{ color: "inherit", fontWeight: 500 }}>
          {alertText}
        </Typography>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outlined"
              size="small"
              sx={{
                color: "inherit",
                borderColor: "currentColor",
                "&:hover": {
                  borderColor: "currentColor",
                  backgroundColor: "rgba(255,255,255,0.1)",
                },
              }}
            >
              {buttonTextAction}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[320px] p-4">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base">{titleDialog}</DialogTitle>
              <DialogDescription className="text-sm">{contentDialog}</DialogDescription>
            </DialogHeader>

            {showSectorSelector ? (
              <div className="py-2">
                <select
                  id="sector-select"
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  disabled={shouldLockSectorChangeOnTakeover}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Selecione um setor</option>
                  {shouldLockSectorChangeOnTakeover &&
                    conversation?.sector &&
                    !availableSectors.some((sector) => sector.id === conversation.sector?.id) && (
                      <option value={conversation.sector.id}>
                        {conversation.sector.name}
                      </option>
                    )}
                  {availableSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : availableSectors.length === 0 && (status === "WATING" || status === "IN_CONVERSATION_WITH_OTHER_ATTENDANT") ? (
              <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md border border-amber-200">
                {status === "WATING"
                  ? "Você não possui setores atribuídos. A conversa será assumida sem setor definido."
                  : "Você não possui setores atribuídos. Não é possível solicitar transferência sem um setor."}
              </div>
            ) : null}

            <DialogFooter className="pt-2 gap-2">
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleProceed}
                variant="contained"
                size="small"
                disabled={status === "IN_CONVERSATION_WITH_OTHER_ATTENDANT" && availableSectors.length === 0}
              >
                {status === "WATING"
                  ? "Assumir"
                  : canTransferDirectly
                    ? "Assumir"
                    : "Solicitar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Alert>
  );
};
