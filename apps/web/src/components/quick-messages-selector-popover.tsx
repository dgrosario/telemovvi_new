"use client";

import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  TextField,
  Typography,
} from "@mui/material";
import { MessageSquareText, Search, Paperclip } from "lucide-react";
import { useState, useMemo, type MouseEvent } from "react";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { listQuickMessages } from "@/app/actions/quick-messages";
import { usePermissionCheck } from "@/hooks/use-permission-check";

interface QuickMessagesSelectorPopoverProps {
  onSelect: (message: string, quickMessageId?: string) => void;
  conversationId?: string;
}

export function QuickMessagesSelectorPopover({
  onSelect,
  conversationId,
}: QuickMessagesSelectorPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission: canCreateQuickMessages } = usePermissionCheck(["create:quick-messages"]);
  const { data: quickMessages = [], isLoading } = useServerActionQuery(
    listQuickMessages,
    {
      input: undefined,
      queryKey: ["list-quick-messages"],
      enabled: canCreateQuickMessages,
    }
  );

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchQuery("");
  };

  const handleSelect = (qm: {
    id: string;
    shortcode: string;
    message: string;
  }) => {
    onSelect(qm.message, qm.id);
    handleClose();
  };

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return quickMessages;

    const query = searchQuery.toLowerCase();
    return quickMessages.filter(
      (qm) =>
        qm.shortcode.toLowerCase().includes(query) ||
        qm.message.toLowerCase().includes(query)
    );
  }, [quickMessages, searchQuery]);

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size="small"
        title="Mensagens Rápidas"
        onClick={handleClick}
        className="hover:bg-gray-100"
      >
        <MessageSquareText className="size-5 text-gray-600" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: { width: 360, p: 0 },
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Mensagens Rápidas
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Clique para inserir no texto
          </Typography>
        </Box>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar por atalho ou Conteúdo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="size-4 text-gray-400" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
              },
            }}
          />
        </Box>
        {isLoading ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 320, overflow: "auto", py: 0 }}>
            {filteredMessages.map((qm) => (
              <ListItemButton
                key={qm.id}
                onClick={() => handleSelect(qm)}
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
                      <Typography
                        component="code"
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "primary.main",
                        }}
                      >
                        /{qm.shortcode}
                      </Typography>
                      {qm.mediaUrl && (
                        <Paperclip className="size-3.5 text-gray-400" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        mt: 0.5,
                      }}
                    >
                      {qm.message}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
            {filteredMessages.length === 0 && (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery
                    ? "Nenhuma mensagem encontrada"
                    : "Nenhuma mensagem rapida disponivel"}
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
