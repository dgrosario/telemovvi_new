"use client";

import { useUserSectors } from "@/hooks/use-user-sectors";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (sectorId: string) => void;
  title?: string;
};

export function ModalSelectSector({
  open,
  onClose,
  onSelect,
  title = "Selecione um setor",
}: Props) {
  const { data: sectors, isLoading } = useUserSectors();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
      setSelectedId(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <CircularProgress size={32} />
          </div>
        ) : sectors && sectors.length > 0 ? (
          <List className="!py-0">
            {sectors.map((sector: Sector.Props) => (
              <ListItemButton
                key={sector.id}
                selected={selectedId === sector.id}
                onClick={() => setSelectedId(sector.id)}
                className="!rounded-lg !mb-1"
              >
                <ListItemIcon>
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: sector.color ?? "#3B82F6" }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={sector.name}
                  primaryTypographyProps={{
                    className: selectedId === sector.id ? "!font-semibold" : "",
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        ) : (
          <div className="py-4 text-center text-gray-500">
            Nenhum setor encontrado
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={!selectedId}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
