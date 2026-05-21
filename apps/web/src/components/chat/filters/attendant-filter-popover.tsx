"use client";
import {
  Autocomplete,
  Box,
  Button,
  Popover,
  Stack,
} from "@mui/material";
import CustomTextField from "@/components/custom-text-field";
import type { ChatAttendant } from "@/types/chat-attendant";
import React, { useState, useEffect } from "react";

interface AttendantFilterPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  usersList: ChatAttendant[];
  selectedUsers: string[];
  onApply: (userIds: string[]) => void;
}

export const AttendantFilterPopover: React.FC<AttendantFilterPopoverProps> = ({
  anchorEl,
  onClose,
  usersList,
  selectedUsers,
  onApply,
}) => {
  const [localSelection, setLocalSelection] = useState<ChatAttendant[]>([]);

  useEffect(() => {
    setLocalSelection(
      usersList.filter((u) => selectedUsers.includes(u.id))
    );
  }, [usersList, selectedUsers]);

  const handleApply = () => {
    onApply(localSelection.map((u) => u.id));
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
            options={usersList}
            value={localSelection}
            onChange={(_, newValue) => setLocalSelection(newValue || [])}
            getOptionLabel={(option) => option.name}
            getOptionKey={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <CustomTextField
                {...params}
                label="Selecione os atendentes"
                placeholder="Buscar atendentes..."
                size="small"
              />
            )}
            noOptionsText="Nenhum atendente encontrado"
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
