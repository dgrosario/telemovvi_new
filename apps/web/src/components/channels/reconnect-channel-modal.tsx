"use client";

import {
  cleanupPendingInstance,
  connectChannel,
  disconnectChannel,
  getReconnectImpact,
  reconnectChannel,
} from "@/app/actions/channels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useQRCodeConnection } from "@/hooks/use-qrcode-connection";
import { ProxyConnectHandler } from "@/lib/connect-handlers";
import { Channel, WHATSAPP_FAMILY } from "@omnichannel/core/domain/entities/channel";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type Props = {
  channel: Channel.Raw;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// meta_api exige configuracao manual (appId, appSecret, tokens) incompativel com o wizard de reconexao
type SelectedType = "whatsapp" | "evolution";

type PendingInstance = {
  instanceName: string;
  instanceId: string;
  phoneNumber: string | null;
};

export function ReconnectChannelModal({ channel, open, onOpenChange }: Props) {
  const isWhatsAppFamily = WHATSAPP_FAMILY.includes(channel.type);

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<SelectedType>(
    channel.type === "whatsapp" || channel.type === "evolution"
      ? channel.type
      : "whatsapp"
  );
  const [confirmed, setConfirmed] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<PendingInstance | null>(null);

  const qrCodeChannelId = useQRCodeConnection((s) => s.channelId);
  const wasSuccessful = useQRCodeConnection((s) => s.wasSuccessful);
  const isQRCodeActive = !!qrCodeChannelId;
  const prevQRActiveRef = useRef(false);
  const connectionEstablishedRef = useRef(false);
  const reconnectedRef = useRef(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (prevQRActiveRef.current && !isQRCodeActive) {
      if (wasSuccessful) {
        setStep(3);
      } else {
        setStep(2);
        setIsConnecting(false);
      }
    }
    prevQRActiveRef.current = isQRCodeActive;
  }, [isQRCodeActive, wasSuccessful]);

  const disconnectAction = useServerActionMutation(disconnectChannel);
  const cleanupAction = useServerActionMutation(cleanupPendingInstance);

  const connectChannelAction = useServerActionMutation(connectChannel, {
    onSuccess(data) {
      setIsConnecting(false);
      const result = data as Record<string, unknown> | undefined;
      if (result?.instanceName) {
        setPendingInstance({
          instanceName: result.instanceName as string,
          instanceId: result.instanceId as string,
          phoneNumber: (result.phoneNumber as string) ?? null,
        });
      }
      if (selectedType !== "evolution") {
        setStep(3);
      }
      connectionEstablishedRef.current = true;
    },
    onError(error) {
      setIsConnecting(false);
      toast.error(error.message);
    },
  });

  const { data: impact, isLoading: isLoadingImpact, isError: isImpactError } = useServerActionQuery(
    getReconnectImpact,
    {
      input: { channelId: channel.id },
      queryKey: ["reconnect-impact", channel.id],
      enabled: open,
    }
  );

  const reconnectAction = useServerActionMutation(reconnectChannel, {
    async onSuccess(data) {
      connectionEstablishedRef.current = false;
      reconnectedRef.current = true;
      if (data.flowTerminationFailed) {
        toast.warning("Canal alterado, mas houve falha ao encerrar fluxos ativos. Verifique manualmente.");
      } else {
        toast.success("Canal alterado com sucesso.");
      }
      await queryClient.invalidateQueries({ queryKey: ["list-channels"] });
      handleClose();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    useQRCodeConnection.getState().onClear();
    const wasReconnected = reconnectedRef.current;
    reconnectedRef.current = false;

    if (!wasReconnected) {
      if (pendingInstance) {
        cleanupAction.mutate(
          { instanceName: pendingInstance.instanceName },
          {
            onError: (error) => {
              console.error("[ReconnectChannelModal] Falha ao limpar instância temporária:", error);
            },
          }
        );
        connectionEstablishedRef.current = false;
      } else if (connectionEstablishedRef.current) {
        disconnectAction.mutate(
          { id: channel.id },
          {
            onError: (error) => {
              toast.warning("Não foi possível desconectar automaticamente. Desconecte manualmente na listagem de canais.");
              console.error("[ReconnectChannelModal] Falha ao desconectar na saída:", error);
            },
          }
        );
        connectionEstablishedRef.current = false;
      }
    }

    setStep(1);
    setSelectedType(
      channel.type === "whatsapp" || channel.type === "evolution"
        ? channel.type
        : "whatsapp"
    );
    setConfirmed(false);
    setConfirmName("");
    setIsConnecting(false);
    setPendingInstance(null);
    onOpenChange(false);
  };

  const handleNextFromTypeSelection = () => {
    setStep(2);
  };

  const handleConnect = async () => {
    useQRCodeConnection.getState().onClear();
    setIsConnecting(true);
    const isSameTypeEvolution =
      channel.type === "evolution" && selectedType === "evolution";
    const virtualChannel: Channel.Raw = {
      ...channel,
      type: isWhatsAppFamily ? selectedType : channel.type,
    };
    try {
      await ProxyConnectHandler.instance().connect(
        virtualChannel,
        connectChannelAction.mutateAsync,
        isSameTypeEvolution ? { forceNewInstance: true } : undefined
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Falha ao iniciar conexão"
      );
      setIsConnecting(false);
    }
  };

  const handleConfirmReconnect = () => {
    const newType = isWhatsAppFamily ? selectedType : channel.type;
    reconnectAction.mutate({
      channelId: channel.id,
      newType,
      pendingInstanceName: pendingInstance?.instanceName,
      pendingInstanceId: pendingInstance?.instanceId,
      pendingPhoneNumber: pendingInstance?.phoneNumber,
    });
  };

  const canConfirm =
    confirmed && confirmName === channel.name && !reconnectAction.isPending && !isImpactError;

  const stepTitle: Record<number, string> = {
    1: "Selecionar tipo de conexão",
    2: "Conectar novo canal",
    3: "Confirmar alteração",
  };

  return (
    <Dialog open={open && !isQRCodeActive} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Canal</DialogTitle>
          <DialogDescription>
            {stepTitle[step]} - {channel.name}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && isWhatsAppFamily && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione o tipo de conexão para o canal:
            </p>
            <RadioGroup
              value={selectedType}
              onValueChange={(v) => setSelectedType(v as SelectedType)}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="whatsapp" id="type-whatsapp" />
                <Label htmlFor="type-whatsapp" className="cursor-pointer">
                  API Oficial (Meta Cloud)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="evolution" id="type-evolution" />
                <Label htmlFor="type-evolution" className="cursor-pointer">
                  Baileys (Evolution API - QR Code)
                </Label>
              </div>
            </RadioGroup>
            {!isLoadingImpact && !isImpactError && impact && (impact.openConversations > 0 || impact.activeFlows > 0) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <i className="tabler-alert-triangle mt-0.5" />
                  <span>
                    Este canal possui{" "}
                    <strong>{impact.openConversations}</strong> conversa(s) aberta(s)
                    {impact.activeFlows > 0 && (
                      <> e <strong>{impact.activeFlows}</strong> fluxo(s) ativo(s)</>
                    )}
                    . A reconexão encerrará os fluxos ativos.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && !isWhatsAppFamily && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              O canal será reconectado como{" "}
              <strong>
                {channel.type === "instagram" ? "Instagram" : channel.type}
              </strong>
              .
            </p>
            {!isLoadingImpact && !isImpactError && impact && (impact.openConversations > 0 || impact.activeFlows > 0) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <i className="tabler-alert-triangle mt-0.5" />
                  <span>
                    Este canal possui{" "}
                    <strong>{impact.openConversations}</strong> conversa(s) aberta(s)
                    {impact.activeFlows > 0 && (
                      <> e <strong>{impact.activeFlows}</strong> fluxo(s) ativo(s)</>
                    )}
                    . A reconexão encerrará os fluxos ativos.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            {isConnecting || connectChannelAction.isPending ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">
                  Conectando novo canal...
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Clique no botão abaixo para iniciar a conexão do canal.
                </p>
                <Button onClick={handleConnect}>Iniciar Conexão</Button>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            {isLoadingImpact ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : isImpactError ? (
              <p className="text-center text-sm text-destructive py-4">
                Erro ao carregar dados de impacto. Tente novamente.
              </p>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="tabler-message-circle text-muted-foreground" />
                    <span>
                      <strong>{impact?.openConversations ?? 0}</strong>{" "}
                      conversas abertas neste canal
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="tabler-robot text-muted-foreground" />
                    <span>
                      <strong>{impact?.activeFlows ?? 0}</strong> fluxos ativos
                      serão encerrados
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <i className="tabler-alert-triangle mt-0.5" />
                      <span>
                        Todas as conversas abertas terão seus fluxos de
                        automação encerrados.
                      </span>
                    </div>
                  </div>
                  {selectedType === "whatsapp" && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <div className="flex items-start gap-2">
                        <i className="tabler-alert-triangle mt-0.5" />
                        <span>
                          Será necessário o envio de template para retomar contato
                          com as conversas atuais.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="confirm-understand"
                    checked={confirmed}
                    onCheckedChange={(checked) =>
                      setConfirmed(checked === true)
                    }
                  />
                  <Label
                    htmlFor="confirm-understand"
                    className="text-sm leading-snug cursor-pointer"
                  >
                    {selectedType === "whatsapp"
                      ? "Entendo que os fluxos ativos serão encerrados e precisarei enviar templates para retomar as conversas"
                      : "Entendo que os fluxos ativos serão encerrados"}
                  </Label>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirm-name" className="text-sm">
                    Digite o nome do canal para confirmar:{" "}
                    <strong>{channel.name}</strong>
                  </Label>
                  <Input
                    id="confirm-name"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={channel.name}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={
                  isWhatsAppFamily
                    ? handleNextFromTypeSelection
                    : () => setStep(2)
                }
              >
                Próximo
              </Button>
            </div>
          )}

          {step === 2 && !isConnecting && !connectChannelAction.isPending && (
            <div className="flex justify-between w-full">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          )}

          {step === 3 && !isLoadingImpact && (
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmReconnect}
                disabled={!canConfirm}
                isLoading={reconnectAction.isPending}
              >
                Confirmar Alteração
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
