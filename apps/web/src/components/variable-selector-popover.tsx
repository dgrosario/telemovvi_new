"use client";

import {
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import LockIcon from "@mui/icons-material/Lock";
import { useState, type MouseEvent } from "react";
import { useListSystemVariables } from "@/hooks/use-system-variables";

interface VariableSelectorPopoverProps {
  onSelect: (placeholder: string) => void;
  trigger?: React.ReactNode;
}

export function VariableSelectorPopover({
  onSelect,
  trigger,
}: VariableSelectorPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data: variables, isLoading } = useListSystemVariables();

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (key: string) => {
    onSelect(`{{${key}}}`);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      {trigger ? (
        <Box component="span" onClick={handleClick} sx={{ cursor: "pointer" }}>
          {trigger}
        </Box>
      ) : (
        <IconButton
          size="small"
          title="Inserir variável"
          onClick={handleClick}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
            padding: "6px",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: "action.hover",
            },
          }}
        >
          <CodeIcon sx={{ fontSize: "1.25rem" }} />
        </IconButton>
      )}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
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
            sx: { width: 320, p: 0 },
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Variáveis disponíveis
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Clique para inserir no texto
          </Typography>
        </Box>
        {isLoading ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 280, overflow: "auto", py: 0 }}>
            {variables?.map((variable) => (
              <ListItemButton
                key={variable.id}
                onClick={() => handleSelect(variable.key)}
                sx={{
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemText
                  primaryTypographyProps={{ component: "div" }}
                  secondaryTypographyProps={{ component: "div" }}
                  primary={
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" fontWeight={500}>
                        {variable.label}
                      </Typography>
                      {variable.isSystem && (
                        <LockIcon
                          sx={{ fontSize: "0.875rem", color: "text.disabled" }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5 }}>
                      <Typography
                        component="code"
                        sx={{
                          fontSize: "0.75rem",
                          bgcolor: "action.hover",
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                          display: "inline-block",
                          width: "fit-content",
                          fontFamily: "monospace",
                        }}
                      >
                        {`{{${variable.key}}}`}
                      </Typography>
                      {variable.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          {variable.description}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
            {variables?.length === 0 && (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Nenhuma variável disponível
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
