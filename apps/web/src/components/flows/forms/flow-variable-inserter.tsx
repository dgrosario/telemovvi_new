"use client";

import { useState } from "react";
import {
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Typography,
  Box,
  Tooltip,
  TextField,
  InputAdornment,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import {
  type FlowVariable,
  getVariableCategories,
} from "@/lib/flow-variables";
import { useListSystemVariables } from "@/hooks/use-system-variables";

interface FlowVariableInserterProps {
  flowVariables?: FlowVariable[];
  onInsert: (variable: string) => void;
  disabled?: boolean;
}

function getCategoryIcon(categoryId: string) {
  switch (categoryId) {
    case "system":
      return <SettingsIcon fontSize="small" />;
    case "context":
      return <ChatBubbleOutlineIcon fontSize="small" />;
    case "contact":
      return <PersonOutlineIcon fontSize="small" />;
    case "flow":
      return <AccountTreeIcon fontSize="small" />;
    default:
      return <CodeIcon fontSize="small" />;
  }
}

export function FlowVariableInserter({
  flowVariables = [],
  onInsert,
  disabled = false,
}: FlowVariableInserterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const { data: systemVariables } = useListSystemVariables();

  const categories = getVariableCategories(flowVariables, systemVariables ?? []);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setSearch("");
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearch("");
  };

  const handleSelect = (variable: FlowVariable) => {
    onInsert(`{{${variable.value}}}`);
    handleClose();
  };

  const filteredCategories = categories.map((category) => ({
    ...category,
    variables: category.variables.filter(
      (v) =>
        v.label.toLowerCase().includes(search.toLowerCase()) ||
        v.value.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((category) => category.variables.length > 0);

  return (
    <>
      <Tooltip title="Inserir variavel">
        <IconButton
          size="small"
          onClick={handleClick}
          disabled={disabled}
          sx={{
            color: "primary.main",
            "&:hover": {
              backgroundColor: "primary.lighter",
            },
          }}
        >
          <CodeIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxHeight: 400,
            },
          },
        }}
      >
        <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar variavel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <List
          dense
          sx={{
            maxHeight: 300,
            overflow: "auto",
            "& .MuiListSubheader-root": {
              backgroundColor: "grey.50",
              lineHeight: "36px",
            },
          }}
        >
          {filteredCategories.length === 0 ? (
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Nenhuma variavel encontrada
              </Typography>
            </Box>
          ) : (
            filteredCategories.map((category) => (
              <Box key={category.id}>
                <ListSubheader>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {getCategoryIcon(category.id)}
                    <Typography variant="caption" fontWeight={600}>
                      {category.label}
                    </Typography>
                  </Box>
                </ListSubheader>
                {category.variables.map((variable) => (
                  <ListItemButton
                    key={variable.value}
                    onClick={() => handleSelect(variable)}
                    sx={{ py: 0.5 }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2">{variable.label}</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "primary.main",
                              fontFamily: "monospace",
                              backgroundColor: "primary.lighter",
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            {`{{${variable.value}}}`}
                          </Typography>
                        </Box>
                      }
                      secondary={variable.description}
                      secondaryTypographyProps={{
                        variant: "caption",
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                ))}
              </Box>
            ))
          )}
        </List>
      </Popover>
    </>
  );
}
