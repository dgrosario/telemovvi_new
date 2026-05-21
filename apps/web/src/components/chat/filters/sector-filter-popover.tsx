"use client";
import {
  Autocomplete,
  Box,
  Button,
  Popover,
  Stack,
} from "@mui/material";
import CustomTextField from "@/components/custom-text-field";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import React, { useState, useEffect } from "react";

interface SectorFilterPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  sectorsList: Sector.Props[];
  selectedSectors: string[];
  onApply: (sectorIds: string[]) => void;
}

export const SectorFilterPopover: React.FC<SectorFilterPopoverProps> = ({
  anchorEl,
  onClose,
  sectorsList,
  selectedSectors,
  onApply,
}) => {
  const [localSelection, setLocalSelection] = useState<Sector.Props[]>([]);

  useEffect(() => {
    setLocalSelection(
      sectorsList.filter((s) => selectedSectors.includes(s.id))
    );
  }, [sectorsList, selectedSectors]);

  const handleApply = () => {
    onApply(localSelection.map((s) => s.id));
    onClose();
  };

  const handleClear = () => {
    setLocalSelection([]);
  };

  const open = Boolean(anchorEl);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      slotProps={{
        paper: {
          sx: {
            mt: 1,
            minWidth: 320,
            maxWidth: 400,
          },
        },
      }}
    >
      <Box p={2}>
        <Stack spacing={2}>
          <Autocomplete
            multiple
            size="small"
            options={sectorsList}
            value={localSelection}
            onChange={(_, newValue) => setLocalSelection(newValue || [])}
            getOptionLabel={(option) => option.name}
            getOptionKey={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <CustomTextField
                {...params}
                label="Selecione os setores"
                placeholder="Buscar setores..."
                size="small"
              />
            )}
            noOptionsText="Nenhum setor encontrado"
            limitTags={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
              },
            }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="outlined"
              size="small"
              onClick={handleClear}
              disabled={localSelection.length === 0}
            >
              Limpar
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleApply}
            >
              Aplicar
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Popover>
  );
};
