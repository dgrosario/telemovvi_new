"use client";

import { AppBar, Toolbar, Typography, Button, Chip, Box, TextField, IconButton, CircularProgress, Tooltip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import PublishIcon from "@mui/icons-material/Publish";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import { useRouter } from "next/navigation";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { useUpdateFlow } from "@/hooks/use-flows";
import { useFlowSave } from "@/hooks/use-auto-save";
import { Flow } from "@omnichannel/core/domain/entities/flow";
import { useState } from "react";
import { toast, Flip } from "react-toastify";

interface FlowEditorToolbarProps {
  flowName: string;
  flowStatus: Flow.Status;
}

export function FlowEditorToolbar({ flowName, flowStatus }: FlowEditorToolbarProps) {
  const router = useRouter();
  const flowId = useFlowEditorStore((s) => s.flowId);
  const { mutate: updateFlow, isPending } = useUpdateFlow();
  const { isSaving, isDirty, save } = useFlowSave();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(flowName);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    if (!flowId) return;

    setIsPublishing(true);
    try {
      // Primeiro salva as alterações pendentes
      if (isDirty) {
        await save();
      }

      // Depois publica (muda status de draft para inactive)
      updateFlow(
        {
          flowId,
          status: "inactive",
        },
        {
          onSuccess: () => {
            toast.success("Fluxo publicado com sucesso! Agora pode ser ativado.", { transition: Flip });
            router.refresh();
          },
          onError: () => {
            toast.error("Erro ao publicar o fluxo", { transition: Flip });
          },
          onSettled: () => {
            setIsPublishing(false);
          },
        }
      );
    } catch {
      setIsPublishing(false);
      toast.error("Erro ao salvar alterações antes de publicar", { transition: Flip });
    }
  };

  const handleSaveName = () => {
    if (!flowId || !editedName.trim()) return;

    updateFlow(
      {
        flowId,
        name: editedName,
      },
      {
        onSuccess: () => {
          setIsEditingName(false);
        },
      }
    );
  };

  const handleCancelEditName = () => {
    setEditedName(flowName);
    setIsEditingName(false);
  };

  const getStatusColor = () => {
    switch (flowStatus) {
      case "active":
        return "success";
      case "inactive":
        return "error";
      case "draft":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusLabel = () => {
    switch (flowStatus) {
      case "active":
        return "Ativo";
      case "inactive":
        return "Inativo";
      case "draft":
        return "Rascunho";
      default:
        return flowStatus;
    }
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/flows")}
          sx={{ mr: 2 }}
        >
          Voltar
        </Button>

        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1 }}>
          {isEditingName ? (
            <>
              <TextField
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                variant="standard"
                autoFocus
                size="small"
                sx={{ minWidth: 200 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  } else if (e.key === "Escape") {
                    handleCancelEditName();
                  }
                }}
              />
              <IconButton
                size="small"
                onClick={handleSaveName}
                disabled={!editedName.trim() || isPending}
                color="primary"
              >
                <CheckIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleCancelEditName}
                disabled={isPending}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <>
              <Typography variant="h6" component="div">
                {flowName}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setIsEditingName(true)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>

        <Chip
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
          sx={{ mr: 2 }}
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 2 }}>
          {isSaving ? (
            <>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Salvando...
              </Typography>
            </>
          ) : isDirty ? (
            <>
              <CloudSyncIcon fontSize="small" color="warning" />
              <Typography variant="caption" color="text.secondary">
                Alterações pendentes
              </Typography>
            </>
          ) : (
            <>
              <CloudDoneIcon fontSize="small" color="success" />
              <Typography variant="caption" color="text.secondary">
                Salvo
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={save}
            disabled={isSaving || !isDirty}
          >
            Salvar
          </Button>

          {flowStatus === "draft" && (
            <Tooltip title="Publicar o fluxo para poder ativá-lo">
              <Button
                variant="contained"
                color="success"
                startIcon={isPublishing ? <CircularProgress size={16} color="inherit" /> : <PublishIcon />}
                onClick={handlePublish}
                disabled={isPublishing || isSaving}
              >
                Publicar
              </Button>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
