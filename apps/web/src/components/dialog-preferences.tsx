"use client";

import { updateSignaturePreference } from "@/app/actions/users";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/app/actions/notifications";
import { Button, FormControlLabel, Switch, Checkbox } from "@mui/material";
import { useServerAction } from "zsa-react";
import { toast } from "react-toastify";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Notification } from "@omnichannel/core/domain/entities/notification";
import { useUserPermissions } from "@/providers/user-permissions-provider";
import { useNotificationStore } from "@/hooks/use-notification-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signatureEnabled: boolean;
  onSignatureChange?: (enabled: boolean) => void;
};

const notificationTypes: { value: Notification.Type; label: string }[] = [
  { value: "conversation:assigned", label: "Conversa atribuída" },
  { value: "internal:message", label: "Mensagens internas" },
  { value: "transfer:requested", label: "Transferência solicitada" },
  { value: "channel:new-message", label: "Nova mensagem em canal" },
];

export function DialogPreferences({
  open,
  onOpenChange,
  signatureEnabled,
  onSignatureChange,
}: Props) {
  const { hasPermission } = useUserPermissions();
  const [localSignatureEnabled, setLocalSignatureEnabled] =
    useState(signatureEnabled);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [showFloatingButton, setShowFloatingButton] = useState(true);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Notification.Type[]>([
    "conversation:assigned",
    "internal:message",
    "transfer:requested",
    "channel:new-message",
  ]);
  const setFloatingButtonEnabled = useNotificationStore(
    (state) => state.setFloatingButtonEnabled
  );

  const canListAllConversations = hasPermission(["list:all-conversations"]);

  useEffect(() => {
    if (open) {
      setLocalSignatureEnabled(signatureEnabled);
      getNotificationSettings({})
        .then((settings) => {
          if (settings[0]) {
            setRealtimeEnabled(settings[0].realtimeEnabled);
            setShowFloatingButton(settings[0].showFloatingButton);
            setShowAllConversations(settings[0].showAllConversations);
            setEnabledTypes(settings[0].enabledTypes);
            setFloatingButtonEnabled(settings[0].showFloatingButton);
          }
        })
        .catch(() => {});
    }
  }, [open, signatureEnabled, setFloatingButtonEnabled]);

  const updatePreferenceAction = useServerAction(updateSignaturePreference, {
    onSuccess: () => {
      toast.success("Preferencias salvas com sucesso");
      onSignatureChange?.(localSignatureEnabled);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.err.message);
    },
  });

  const updateNotificationAction = useServerAction(updateNotificationSettings, {
    onSuccess: () => {},
    onError: (error) => {
      toast.error(error.err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        updatePreferenceAction.execute({ enabled: localSignatureEnabled }),
        updateNotificationAction.execute({
          realtimeEnabled,
          showFloatingButton,
          showAllConversations,
          enabledTypes,
        }),
      ]);
      setFloatingButtonEnabled(showFloatingButton);
    } catch (error) {}
  };

  const handleToggleNotificationType = (type: Notification.Type) => {
    setEnabledTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleClose = () => {
    setLocalSignatureEnabled(signatureEnabled);
    setRealtimeEnabled(true);
    setShowFloatingButton(true);
    setShowAllConversations(false);
    setEnabledTypes([
      "conversation:assigned",
      "internal:message",
      "transfer:requested",
      "channel:new-message",
    ]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferencias</DialogTitle>
          <DialogDescription>
            Configure suas preferencias de uso
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm">Mensagens</h3>
            <FormControlLabel
              control={
                <Switch
                  checked={localSignatureEnabled}
                  onChange={(e) => setLocalSignatureEnabled(e.target.checked)}
                />
              }
              label="Habilitar assinatura de mensagens"
            />
            <p className="text-sm text-gray-500 ml-12">
              Quando habilitado, você pode escolher se deseja assinar cada
              mensagem com seu nome no chat
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t">
            <h3 className="font-semibold text-sm">Notificações</h3>
            <FormControlLabel
              control={
                <Switch
                  checked={realtimeEnabled}
                  onChange={(e) => setRealtimeEnabled(e.target.checked)}
                />
              }
              label="Habilitar notificações em tempo real"
            />
            <p className="text-sm text-gray-500 ml-12">
              Receba notificações instantâneas de novos eventos
            </p>

            <FormControlLabel
              control={
                <Switch
                  checked={showFloatingButton}
                  onChange={(e) => setShowFloatingButton(e.target.checked)}
                />
              }
              label="Mostrar botão flutuante de notificações"
            />
            <p className="text-sm text-gray-500 ml-12">
              Exibe um botão flutuante quando há notificações não lidas
            </p>

            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm font-medium">Tipos de notificação</p>
              {notificationTypes.map((type) => (
                <FormControlLabel
                  key={type.value}
                  control={
                    <Checkbox
                      checked={enabledTypes.includes(type.value)}
                      onChange={() => handleToggleNotificationType(type.value)}
                    />
                  }
                  label={type.label}
                />
              ))}
            </div>
          </div>

          {canListAllConversations && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <h3 className="font-semibold text-sm">Conversas</h3>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAllConversations}
                    onChange={(e) => setShowAllConversations(e.target.checked)}
                  />
                }
                label="Visualizar todas as conversas"
              />
              <p className="text-sm text-gray-500 ml-12">
                Quando habilitado, exibe todas as conversas do sistema, incluindo
                as que não foram atribuídas a você
              </p>
            </div>
          )}

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outlined" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="contained"
              disabled={updatePreferenceAction.isPending}
            >
              {updatePreferenceAction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
