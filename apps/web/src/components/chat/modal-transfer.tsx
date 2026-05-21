"use client";
import { transferConversation } from "@/app/actions/conversations";
import { transferConversationInputSchema } from "@/app/actions/conversations/schema";
import { listUsersBySectorForTransfer, validateTransferPermission } from "@/app/actions/users";
import { listSectorsForTransfer } from "@/app/actions/sectors";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { useCanViewContactDetails } from "@/hooks/use-permission-check";
import { useFormState } from "@/hooks/use-form-state";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Forward } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import CustomTextField from "../custom-text-field";

type Props = {
  conversation?: Conversation.Raw;
};

export const ModalTransfer: React.FC<Props> = ({ conversation }) => {
  const store = useChat();
  const canViewInCurrentSector = useCanViewContactDetails(conversation?.sector?.id);
  const { form, setField, reset, errors, validateAll } = useFormState(
    transferConversationInputSchema,
    {
      attendantId: "",
      conversationId: "",
      sectorId: "",
    }
  );

  const listUsersAction = useServerActionQuery(listUsersBySectorForTransfer, {
    input: { sectorId: form.sectorId },
    queryKey: ["attendants-for-transfer", form.sectorId],
    enabled: !!form.sectorId && store.openModalTransfer,
  });

  const validateTransferPermissionAction = useServerActionQuery(
    validateTransferPermission,
    {
      input: { userId: store.user?.id! },
      queryKey: ["users"],
      enabled: !!store.user?.id,
    }
  );

  // Buscar setores disponíveis para transferência (todos os setores do workspace)
  const { data: availableSectors = [], isLoading: isLoadingSectors } =
    useServerActionQuery(listSectorsForTransfer, {
      queryKey: ["sectors-for-transfer"],
      input: undefined,
      enabled: store.openModalTransfer,
    });

  const filteredAttendants = useMemo(() => {
    if (!form.sectorId) return [];

    return (
      listUsersAction.data
        ?.filter((a) => a.id !== store.user?.id)
        ?.filter((a) => a.isActive) ?? []
    );
  }, [listUsersAction.data, form.sectorId, store.user?.id]);

  const showAttendantsDropdown = useMemo(() => {
    if (!form.sectorId) return false;
    return true;
  }, [form.sectorId]);

  const isLoadingUsers = listUsersAction.isLoading && !!form.sectorId;

  const hasNoOtherAttendants = useMemo(() => {
    return form.sectorId && !isLoadingUsers && filteredAttendants.length === 0;
  }, [form.sectorId, isLoadingUsers, filteredAttendants.length]);

  const transferConversationAction = useServerActionMutation(
    transferConversation,
    {
      onSuccess: async () => {
        store.toggleOpenModalTransfer();
        toast.success("Transferência realizada com sucesso!");
      },
      onError: (err) => {
        toast.error((err as Error).message || "Erro ao transferir");
      },
    }
  );

  useEffect(() => {
    if (!store.openModalTransfer) {
      reset();
    }
  }, [store.openModalTransfer]);

  useEffect(() => {
    if (store.conversationOpenedId) {
      setField("conversationId", store.conversationOpenedId);
    }
  }, [store.conversationOpenedId]);

  const canTransfer =
    canViewInCurrentSector &&
    (conversation?.attendant?.id === store.user?.id ||
    conversation?.status === "waiting" ||
    conversation?.status === "expired");
    
  // Early return DEPOIS de todos os hooks
  if (!canTransfer) return <></>;

  return (
    <>
      <Tooltip title="Transferir atendimento">
        <IconButton
          onClick={() => store.toggleOpenModalTransfer()}
          className="data-[active=true]:bg-sky-500 group rounded-lg"
        >
          <Forward className="size-4 group-data-[active=true]:!stroke-sky-100" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={store.openModalTransfer}
        maxWidth="xs"
        fullWidth
        onClose={() => store.toggleOpenModalTransfer()}
        closeAfterTransition={false}
      >
        <DialogTitle>Transferência de atendimento</DialogTitle>
        <DialogContent className="space-y-4 !pb-6">
          {isLoadingSectors ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-100 rounded-md">
              Carregando setores disponíveis...
            </div>
          ) : availableSectors.length === 0 ? (
            <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md border border-red-200">
              Nenhum setor disponível para transferência. Você não possui setores atribuídos e este canal não tem setores configurados.
            </div>
          ) : (
            <>
              <CustomTextField
                fullWidth
                value={form.sectorId}
                label="Selecione o setor"
                select
                error={!!errors.sectorId}
                helperText={errors.sectorId || "Setores vinculados ao canal ou atribuídos a você"}
                slotProps={{
                  select: {
                    onChange: (e: any) => {
                      setField("sectorId", e.target.value as string);
                      setField("attendantId", "");
                    },
                  },
                }}
              >
                {availableSectors.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </CustomTextField>

              {showAttendantsDropdown &&
                (isLoadingUsers ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-100 rounded-md">
                    Carregando atendentes do setor...
                  </div>
                ) : hasNoOtherAttendants ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-100 rounded-md">
                    Nenhum outro atendente neste setor. A conversa será transferida
                    apenas para o setor.
                  </div>
                ) : (
                  <CustomTextField
                    fullWidth
                    value={form.attendantId}
                    label="Selecione o atendente (opcional)"
                    select
                    error={!!errors.attendantId}
                    helperText={errors.attendantId}
                    slotProps={{
                      select: {
                        onChange: (e: any) => {
                          setField("attendantId", e.target.value as string);
                        },
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Nenhum (apenas setor)</em>
                    </MenuItem>
                    {filteredAttendants?.map((attendant) => (
                      <MenuItem key={attendant.id} value={attendant.id}>
                        {attendant.name}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => store.toggleOpenModalTransfer()}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={
              transferConversationAction.isPending ||
              isLoadingSectors ||
              availableSectors.length === 0
            }
            onClick={() => {
              const result = validateAll();
              if (!result) return;
              transferConversationAction.mutate(form);
            }}
          >
            {transferConversationAction.isPending
              ? "Transferindo..."
              : "Transferir"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
