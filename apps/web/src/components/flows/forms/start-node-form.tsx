"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { Channel, typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";
import {
  useListChannelsForFlow,
  useAssociateFlowWithChannels,
  useListSectorsForFlow,
  useAssociateFlowWithSectors,
} from "@/hooks/use-flows";
import { useFlowSave } from "@/hooks/use-auto-save";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listChannels } from "@/app/actions/channels";
import { listSectors } from "@/app/actions/sectors";
import { Flip, toast } from "react-toastify";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { Box } from "@mui/material";

const STATUS_OPTIONS = [
  { value: "waiting", label: "Pendentes", description: "Conversas aguardando atendimento" },
  { value: "open", label: "Em Aberto", description: "Conversas em atendimento" },
  { value: "closed", label: "Concluídas", description: "Conversas finalizadas" },
  { value: "expired", label: "Expiradas", description: "Conversas expiradas por inatividade" },
];

interface StartNodeFormProps {
  flowId: string;
  nodeId: string;
  initialData?: {
    triggerOnStatuses?: string[];
    allowConversationsWithoutSector?: boolean;
  };
  onClose: () => void;
}

export function StartNodeForm({ flowId, nodeId, initialData, onClose }: StartNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);
  const { save: saveFlow } = useFlowSave();
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [triggerOnStatuses, setTriggerOnStatuses] = useState<string[]>(
    initialData?.triggerOnStatuses ?? []
  );
  const [allowConversationsWithoutSector, setAllowConversationsWithoutSector] = useState<boolean>(
    initialData?.allowConversationsWithoutSector ?? false
  );

  const { data: allChannels, isLoading: isLoadingAllChannels } =
    useServerActionQuery(listChannels, {
      input: undefined,
      queryKey: ["channels"],
    });

  const { data: allSectors, isLoading: isLoadingAllSectors } =
    useServerActionQuery(listSectors, {
      input: undefined,
      queryKey: ["sectors"],
    });

  const { data: flowChannels, isLoading: isLoadingFlowChannels } =
    useListChannelsForFlow(flowId);

  const { data: flowSectors, isLoading: isLoadingFlowSectors } =
    useListSectorsForFlow(flowId);

  const { mutateAsync: associateChannels, isPending: isSavingChannels } =
    useAssociateFlowWithChannels();

  const { mutateAsync: associateSectors, isPending: isSavingSectors } =
    useAssociateFlowWithSectors();

  const isSaving = isSavingChannels || isSavingSectors;

  useEffect(() => {
    if (flowChannels) {
      const ids = flowChannels.map((c) => c.id);
      setSelectedChannelIds(ids);
    }
  }, [flowChannels]);

  useEffect(() => {
    if (flowSectors) {
      const ids = flowSectors.map((s) => s.id);
      setSelectedSectorIds(ids);
    }
  }, [flowSectors]);

  const isLoading = isLoadingAllChannels || isLoadingFlowChannels || isLoadingAllSectors || isLoadingFlowSectors;

  const hasChanges = useMemo(() => {
    const originalChannelIds = flowChannels?.map((c) => c.id) ?? [];
    const originalSectorIds = flowSectors?.map((s) => s.id) ?? [];
    const originalStatuses = initialData?.triggerOnStatuses ?? [];

    const channelsChanged =
      selectedChannelIds.length !== originalChannelIds.length ||
      selectedChannelIds.some((id) => !originalChannelIds.includes(id));

    const sectorsChanged =
      selectedSectorIds.length !== originalSectorIds.length ||
      selectedSectorIds.some((id) => !originalSectorIds.includes(id));

    const statusesChanged =
      triggerOnStatuses.length !== originalStatuses.length ||
      triggerOnStatuses.some((s) => !originalStatuses.includes(s));

    const allowWithoutSectorChanged =
      allowConversationsWithoutSector !== (initialData?.allowConversationsWithoutSector ?? false);

    return channelsChanged || sectorsChanged || statusesChanged || allowWithoutSectorChanged;
  }, [selectedChannelIds, selectedSectorIds, triggerOnStatuses, allowConversationsWithoutSector, flowChannels, flowSectors, initialData?.triggerOnStatuses, initialData?.allowConversationsWithoutSector]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const toggleSector = (sectorId: string) => {
    setSelectedSectorIds((prev) =>
      prev.includes(sectorId)
        ? prev.filter((id) => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const toggleStatus = (status: string) => {
    setTriggerOnStatuses((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const handleSave = async () => {
    try {
      await Promise.all([
        associateChannels({
          flowId,
          channelIds: selectedChannelIds,
        }),
        associateSectors({
          flowId,
          sectorIds: selectedSectorIds,
        }),
      ]);

      updateNodeData(nodeId, { triggerOnStatuses, allowConversationsWithoutSector });
      await saveFlow();

      toast.success("Configurações salvas com sucesso!", { transition: Flip });
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Erro ao salvar configurações", { transition: Flip });
    }
  };

  const getChannelIcon = (type: string): string => {
    const channelType = typeChannelsAvailable.get(type as Channel.Type);
    return channelType?.icon.split(" ")[0] ?? "tabler:message";
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={4}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Carregando configurações...
        </Typography>
      </Stack>
    );
  }

  if (!allChannels || allChannels.length === 0) {
    return (
      <Alert severity="info">
        Nenhum canal disponível. Crie um canal primeiro para vincular ao fluxo.
      </Alert>
    );
  }

  return (
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      <Stack>
        <Typography variant="subtitle2" fontWeight="semibold">
          Canais Vinculados
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selecione os canais que ativarão este fluxo quando receberem mensagens
        </Typography>
      </Stack>

      <List disablePadding>
        {allChannels.map((channel) => {
          const isSelected = selectedChannelIds.includes(channel.id);
          const isDisconnected = channel.status === "disconnected";

          return (
            <ListItem
              key={channel.id}
              disablePadding
              secondaryAction={
                <Checkbox
                  edge="end"
                  checked={isSelected}
                  onChange={() => toggleChannel(channel.id)}
                  disabled={isSaving}
                />
              }
              sx={{
                opacity: isDisconnected ? 0.6 : 1,
              }}
            >
              <ListItemButton
                onClick={() => toggleChannel(channel.id)}
                disabled={isSaving}
                sx={{ borderRadius: 1 }}
              >
                <ListItemAvatar>
                  <Icon
                    icon={getChannelIcon(channel.type)}
                    width={24}
                    height={24}
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={channel.name}
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {channel.type}
                      </Typography>
                      {isDisconnected && (
                        <Typography variant="caption" color="warning.main">
                          (desconectado)
                        </Typography>
                      )}
                    </Stack>
                  }
                  slotProps={{
                    primary: { className: "mr-2" },
                    secondary: { component: "div" },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ my: 2 }} />

      <Stack>
        <Typography variant="subtitle2" fontWeight="semibold">
          Setores Vinculados
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selecione os setores que ativarão este fluxo (deixe vazio para todos)
        </Typography>
      </Stack>

      <List disablePadding>
        {allSectors && allSectors.length > 0 && (
          <ListItem
            disablePadding
            secondaryAction={
              <Checkbox
                edge="end"
                checked={selectedSectorIds.length === allSectors.length}
                indeterminate={selectedSectorIds.length > 0 && selectedSectorIds.length < allSectors.length}
                onChange={() => {
                  if (selectedSectorIds.length === allSectors.length) {
                    setSelectedSectorIds([]);
                  } else {
                    setSelectedSectorIds(allSectors.map((s) => s.id));
                  }
                }}
                disabled={isSaving}
              />
            }
          >
            <ListItemButton
              onClick={() => {
                if (selectedSectorIds.length === allSectors.length) {
                  setSelectedSectorIds([]);
                } else {
                  setSelectedSectorIds(allSectors.map((s) => s.id));
                }
              }}
              disabled={isSaving}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary="Selecionar Todos"
                secondary={`${selectedSectorIds.length} de ${allSectors.length} selecionado(s)`}
              />
            </ListItemButton>
          </ListItem>
        )}
        {allSectors && allSectors.length > 0 ? (
          allSectors.map((sector) => {
            const isSelected = selectedSectorIds.includes(sector.id);

            return (
              <ListItem
                key={sector.id}
                disablePadding
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={isSelected}
                    onChange={() => toggleSector(sector.id)}
                    disabled={isSaving}
                  />
                }
              >
                <ListItemButton
                  onClick={() => toggleSector(sector.id)}
                  disabled={isSaving}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemAvatar>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: sector.color || "#9e9e9e",
                      }}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={sector.name}
                    secondary={sector.isDefault ? "Setor padrão" : undefined}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Nenhum setor disponível
          </Typography>
        )}
      </List>

      {selectedSectorIds.length > 0 && (
        <List disablePadding sx={{ mt: 2 }}>
          <ListItem
            disablePadding
            secondaryAction={
              <Checkbox
                edge="end"
                checked={allowConversationsWithoutSector}
                onChange={() => setAllowConversationsWithoutSector(!allowConversationsWithoutSector)}
                disabled={isSaving}
              />
            }
          >
            <ListItemButton
              onClick={() => setAllowConversationsWithoutSector(!allowConversationsWithoutSector)}
              disabled={isSaving}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary="Permitir conversas sem setor"
                secondary="Conversas sem setor atribuído também podem disparar este fluxo"
              />
            </ListItemButton>
          </ListItem>
        </List>
      )}

      <Divider sx={{ my: 2 }} />

      <Stack>
        <Typography variant="subtitle2" fontWeight="semibold">
          Disparar em Status
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selecione os status de conversa que ativarão este fluxo
        </Typography>
      </Stack>

      <List disablePadding>
        {STATUS_OPTIONS.map((option) => (
          <ListItem
            key={option.value}
            disablePadding
            secondaryAction={
              <Checkbox
                edge="end"
                checked={triggerOnStatuses.includes(option.value)}
                onChange={() => toggleStatus(option.value)}
                disabled={isSaving}
              />
            }
          >
            <ListItemButton
              onClick={() => toggleStatus(option.value)}
              disabled={isSaving}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={option.label}
                secondary={option.description}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary">
          {selectedChannelIds.length === 0
            ? "Nenhum canal selecionado"
            : `${selectedChannelIds.length} canal(is) selecionado(s)`}
          {" | "}
          {selectedSectorIds.length === 0
            ? "Todos os setores"
            : `${selectedSectorIds.length} setor(es) selecionado(s)`}
          {" | "}
          {triggerOnStatuses.length === 0
            ? "Nenhum status selecionado"
            : `${triggerOnStatuses.length} status selecionado(s)`}
        </Typography>

        <Button
          onClick={handleSave}
          variant="contained"
          fullWidth
          disabled={isSaving || !hasChanges}
        >
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </Stack>
    </Stack>
  );
}
