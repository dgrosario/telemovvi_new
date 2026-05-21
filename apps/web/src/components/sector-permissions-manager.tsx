"use client";

import { listSectors } from "@/app/actions/sectors";
import {
  listBlockedSectorsForContactDetails,
  setBlockedSectorsForContactDetails,
} from "@/app/actions/sector-permissions";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

type Props = {
  userId: string;
  open?: boolean;
  onClose?: () => void;
  renderTrigger?: boolean;
};

export const SectorPermissionsManager: React.FC<Props> = ({
  userId,
  open: controlledOpen,
  onClose,
  renderTrigger = true,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen !== undefined) {
      if (!value && onClose) onClose();
    } else {
      setInternalOpen(value);
    }
  };

  const queryClient = useQueryClient();
  // Agora armazena os setores BLOQUEADOS (que o usuário NÃO pode ver)
  const [blockedSectorIds, setBlockedSectorIds] = useState<Set<string>>(
    new Set()
  );

  const { data: sectors = [], isLoading: isLoadingSectors } =
    useServerActionQuery(listSectors, {
      input: undefined,
      queryKey: ["list-sectors"],
      enabled: open,
    });

  const { data: blockedSectors, isLoading: isLoadingBlocked } =
    useServerActionQuery(listBlockedSectorsForContactDetails, {
      input: { userId },
      queryKey: ["blocked-sectors-contact-details", userId],
      enabled: open && !!userId,
    });

  const saveAction = useServerActionMutation(setBlockedSectorsForContactDetails, {
    onSuccess() {
      toast.success("Restrições de setores salvas com sucesso");
      queryClient.invalidateQueries({
        queryKey: ["blocked-sectors-contact-details", userId],
      });
      setOpen(false);
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  // Carrega os setores bloqueados quando abre o modal
  useEffect(() => {
    if (blockedSectors) {
      setBlockedSectorIds(new Set(blockedSectors.map((s) => s.sectorId)));
    }
  }, [blockedSectors]);

  const toggleSector = (sectorId: string) => {
    setBlockedSectorIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectorId)) {
        next.delete(sectorId);
      } else {
        next.add(sectorId);
      }
      return next;
    });
  };

  const handleSave = () => {
    saveAction.mutate({
      userId,
      sectorIds: Array.from(blockedSectorIds),
    });
  };

  const handleBlockAll = () => {
    setBlockedSectorIds(new Set(sectors.map((s) => s.id)));
  };

  const handleClearAll = () => {
    setBlockedSectorIds(new Set());
  };

  return (
    <>
      {renderTrigger && (
        <Button
          disableRipple
          variant="text"
          fullWidth
          className="!w-full hover:!bg-transparent !pl-5 !justify-start"
          startIcon={<i className="tabler-building text-gray-800 !size-4" />}
          onClick={() => setOpen(true)}
        >
          <span className="font-light text-gray-800">
            Restrições de Setores
          </span>
        </Button>
      )}
      <Dialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={() => setOpen(false)}
        scroll="paper"
      >
        <DialogTitle variant="h5" className="font-semibold">
          Restrições de Visualização por Setor
        </DialogTitle>

        <DialogContent className="!pt-4">
          <Typography variant="body2" className="text-gray-600 mb-4">
            Selecione os setores que este usuário <strong>NÃO</strong> pode
            visualizar os dados completos do contato (número, metadados). 
            Setores marcados em vermelho estão bloqueados.
          </Typography>

          <div className="flex gap-2 mb-4">
            <Button variant="outlined" size="small" color="error" onClick={handleBlockAll}>
              Bloquear Todos
            </Button>
            <Button variant="outlined" size="small" onClick={handleClearAll}>
              Liberar Todos
            </Button>
          </div>

          {isLoadingSectors || isLoadingBlocked ? (
            <Typography className="text-center py-4">Carregando...</Typography>
          ) : (
            <List className="max-h-[300px] overflow-auto border rounded">
              {sectors.map((sector) => {
                const isBlocked = blockedSectorIds.has(sector.id);
                return (
                  <ListItem
                    key={sector.id}
                    disablePadding
                    className={isBlocked ? "bg-red-50" : ""}
                    secondaryAction={
                      <Checkbox
                        edge="end"
                        tabIndex={-1}
                        disableRipple
                        checked={isBlocked}
                        onChange={() => toggleSector(sector.id)}
                        sx={{
                          color: isBlocked ? "error.main" : undefined,
                          "&.Mui-checked": {
                            color: "error.main",
                          },
                        }}
                      />
                    }
                  >
                    <ListItemButton onClick={() => toggleSector(sector.id)}>
                      <ListItemText
                        primary={
                          <span className={isBlocked ? "text-red-600 font-medium" : ""}>
                            {sector.name}
                            {isBlocked && (
                              <i className="tabler-lock ml-2 !size-4 inline-block align-middle" />
                            )}
                          </span>
                        }
                        secondary={
                          sector.isDefault ? "Setor padrão" : undefined
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
              {sectors.length === 0 && (
                <Typography className="text-center py-4 text-muted-foreground">
                  Nenhum setor cadastrado
                </Typography>
              )}
            </List>
          )}

          <Typography variant="caption" className="text-gray-500 mt-4 block">
            {blockedSectorIds.size === 0
              ? "Nenhuma restrição = pode ver todos os setores"
              : `${blockedSectorIds.size} setor(es) bloqueado(s)`}
          </Typography>
        </DialogContent>

        <DialogActions className="!px-6 !py-4 gap-4 border-t">
          <Button variant="outlined" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saveAction.isPending}
          >
            {saveAction.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
