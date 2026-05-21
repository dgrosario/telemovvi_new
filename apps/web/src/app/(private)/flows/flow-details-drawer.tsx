"use client";

import { useFlowsUI } from "@/hooks/use-flows-ui";
import {
  useDeleteFlow,
  useDuplicateFlow,
  useUpdateFlow,
  useListChannelsForFlow,
  useAssociateFlowWithChannels,
} from "@/hooks/use-flows";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { retrieveFlow } from "@/app/actions/flows";
import { listChannels } from "@/app/actions/channels";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Button,
  Checkbox,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Switch,
  Tooltip,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flip, toast } from "react-toastify";
import CustomAvatar from "@/components/custom-avatar";

export function FlowDetailsDrawer() {
  const router = useRouter();
  const { selectedFlowId, detailsOpen, toggleDetailsOpen, setSelectedFlowId } = useFlowsUI();

  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());

  const flowQuery = useServerActionQuery(retrieveFlow, {
    input: { flowId: selectedFlowId },
    enabled: Boolean(selectedFlowId) && detailsOpen,
    queryKey: ["flow-details", selectedFlowId],
  });

  const channelsQuery = useServerActionQuery(listChannels, {
    input: undefined,
    enabled: detailsOpen,
    queryKey: ["channels-for-flow-drawer"],
  });

  const flowChannelsQuery = useListChannelsForFlow(selectedFlowId);

  const { mutateAsync: updateFlow, isPending: isUpdating } = useUpdateFlow();
  const { mutateAsync: deleteFlow, isPending: isDeleting } = useDeleteFlow();
  const { mutateAsync: duplicateFlow, isPending: isDuplicating } = useDuplicateFlow();
  const { mutateAsync: associateChannels, isPending: isAssociating } = useAssociateFlowWithChannels();

  useEffect(() => {
    if (flowChannelsQuery.data) {
      const channelIds = flowChannelsQuery.data.map((c) => c.id);
      setSelectedChannels(new Set(channelIds));
    }
  }, [flowChannelsQuery.data]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      toggleDetailsOpen();
      setSelectedFlowId("");
    }
  };

  const handleToggleStatus = async () => {
    if (!flow) return;

    if (flow.status === "draft") {
      toast.warning("Publique o fluxo no editor para poder ativá-lo", { transition: Flip });
      return;
    }

    const newStatus = flow.status === "active" ? "inactive" : "active";

    if (flow.status === "active") {
      const confirmed = confirm(
        "Tem certeza que deseja desativar este fluxo? Ele não será mais executado automaticamente."
      );
      if (!confirmed) return;
    }

    try {
      await updateFlow({ flowId: flow.id, status: newStatus });
      toast.success(
        `Fluxo ${newStatus === "active" ? "ativado" : "desativado"} com sucesso!`,
        { transition: Flip }
      );
      flowQuery.refetch();
    } catch (error) {
      console.error("Erro ao alterar status do fluxo:", error);
      toast.error("Erro ao alterar status do fluxo", { transition: Flip });
    }
  };

  const handleOpenEditor = () => {
    if (!selectedFlowId) return;
    router.push(`/flows/${selectedFlowId}`);
    handleOpenChange(false);
  };

  const handleDuplicate = async () => {
    if (!selectedFlowId) return;

    try {
      await duplicateFlow({ flowId: selectedFlowId });
      toast.success("Fluxo duplicado com sucesso!", { transition: Flip });
      handleOpenChange(false);
    } catch (error) {
      console.error("Erro ao duplicar fluxo:", error);
      toast.error("Erro ao duplicar fluxo", { transition: Flip });
    }
  };

  const handleDelete = async () => {
    if (!selectedFlowId) return;

    const confirmed = confirm("Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    try {
      await deleteFlow({ flowId: selectedFlowId });
      toast.success("Fluxo excluído com sucesso!", { transition: Flip });
      handleOpenChange(false);
    } catch (error) {
      console.error("Erro ao excluir fluxo:", error);
      toast.error("Erro ao excluir fluxo", { transition: Flip });
    }
  };

  const handleChannelToggle = async (channelId: string) => {
    if (!selectedFlowId) return;

    const newSet = new Set(selectedChannels);
    if (newSet.has(channelId)) {
      newSet.delete(channelId);
    } else {
      newSet.add(channelId);
    }
    setSelectedChannels(newSet);

    try {
      await associateChannels({
        flowId: selectedFlowId,
        channelIds: Array.from(newSet),
      });
      flowChannelsQuery.refetch();
    } catch (error) {
      console.error("Erro ao atualizar conexões:", error);
      toast.error("Erro ao atualizar conexões", { transition: Flip });
      setSelectedChannels(selectedChannels);
    }
  };

  const flow = flowQuery.data;
  const channels = channelsQuery.data ?? [];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "inactive":
        return "Inativo";
      case "draft":
        return "Rascunho";
      default:
        return status;
    }
  };

  return (
    <Sheet open={detailsOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhes do Fluxo</SheetTitle>
        </SheetHeader>

        {flowQuery.isPending ? (
          <div className="flex-1 flex items-center justify-center">
            <CircularProgress />
          </div>
        ) : flow ? (
          <>
            <div className="p-4 border-b flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon icon="tabler:git-branch" className="text-2xl text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">{flow.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {flow.nodes?.length ?? 0} blocos
                </p>
              </div>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Icon icon="tabler:pencil" />}
                onClick={handleOpenEditor}
              >
                Editar
              </Button>
              <Button
                variant="text"
                className="!min-w-0 !p-2"
                onClick={() => handleOpenChange(false)}
              >
                <Icon icon="tabler:x" className="text-xl" />
              </Button>
            </div>

            <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
              <TabsList variant="line" className="px-4 shrink-0">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="connections">Conexões</TabsTrigger>
                <TabsTrigger value="actions">Ações</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nome</Label>
                  <p className="text-sm">{flow.name}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex items-center gap-3">
                    {flow.status === "draft" ? (
                      <Tooltip title="Publique o fluxo no editor para poder ativá-lo">
                        <span className="flex items-center gap-2">
                          <Switch
                            size="small"
                            checked={false}
                            disabled
                          />
                          <span className="text-sm text-amber-600">
                            {getStatusLabel(flow.status)}
                          </span>
                        </span>
                      </Tooltip>
                    ) : (
                      <>
                        <Switch
                          size="small"
                          checked={flow.status === "active"}
                          onChange={handleToggleStatus}
                          disabled={isUpdating}
                          color="success"
                        />
                        <span className={`text-sm ${flow.status === "active" ? "text-green-600" : "text-gray-500"}`}>
                          {getStatusLabel(flow.status)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quantidade de Blocos</Label>
                  <p className="text-sm">{flow.nodes?.length ?? 0} blocos</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Criado em</Label>
                  <p className="text-sm">
                    {format(new Date(flow.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Atualizado em</Label>
                  <p className="text-sm">
                    {format(new Date(flow.updatedAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Canais Vinculados</Label>
                  {flowChannelsQuery.data && flowChannelsQuery.data.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {flowChannelsQuery.data.map((channel) => (
                        <span
                          key={channel.id}
                          className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                        >
                          {channel.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum canal vinculado</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="connections" className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione os canais que devem usar este fluxo automaticamente.
                  </p>
                </div>
                <List>
                  {channels.map((channel) => {
                    const isSelected = selectedChannels.has(channel.id);
                    return (
                      <ListItem
                        key={channel.id}
                        disablePadding
                        secondaryAction={
                          <Checkbox
                            edge="end"
                            tabIndex={-1}
                            disableRipple
                            checked={isSelected}
                            onChange={() => handleChannelToggle(channel.id)}
                            disabled={isAssociating}
                          />
                        }
                      >
                        <ListItemButton onClick={() => handleChannelToggle(channel.id)}>
                          <ListItemAvatar>
                            <CustomAvatar color="primary" alt={channel.name}>
                              {channel.name
                                .split(" ")
                                .map((w: string) => w[0])
                                .join("")
                                .slice(0, 2)}
                            </CustomAvatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={channel.name}
                            secondary={channel.type}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                  {channels.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum canal cadastrado
                    </p>
                  )}
                </List>
              </TabsContent>

              <TabsContent value="actions" className="flex-1 overflow-y-auto p-4 space-y-4">
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleOpenEditor}
                  startIcon={<Icon icon="tabler:git-branch" />}
                >
                  Abrir Editor Visual
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                  startIcon={<Icon icon="tabler:copy" />}
                >
                  {isDuplicating ? "Duplicando..." : "Duplicar Fluxo"}
                </Button>

                <div className="border-t pt-4 mt-4">
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={handleDelete}
                    disabled={isDeleting}
                    startIcon={<Icon icon="tabler:trash" />}
                  >
                    {isDeleting ? "Excluindo..." : "Excluir Fluxo"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Fluxo não encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
