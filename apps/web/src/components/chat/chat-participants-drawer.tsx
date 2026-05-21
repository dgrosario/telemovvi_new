"use client";

import { useGroupParticipants } from "@/hooks/use-group-participants";
import { getParticipantNames } from "@/app/actions/groups";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import {
  Avatar,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Skeleton,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

interface ChatParticipantsDrawerProps {
  open: boolean;
  onClose: () => void;
  channelId: string | null | undefined;
  groupJid: string | null | undefined;
  groupName: string | null | undefined;
}

export function ChatParticipantsDrawer({
  open,
  onClose,
  channelId,
  groupJid,
  groupName,
}: ChatParticipantsDrawerProps) {
  const { groupInfo, participants, participantCount, isLoading } = useGroupParticipants({
    channelId,
    groupJid,
    enabled: open,
  });

  // Fetch participant names from database
  const participantJids = useMemo(() => {
    return participants.map((p) => p.id);
  }, [participants]);

  const { data: participantNames } = useServerActionQuery(getParticipantNames, {
    queryKey: ["participant-names", participantJids],
    input: { participantJids },
    enabled: open && participantJids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const sortedParticipants = useMemo(() => {
    if (!participants) return [];
    return [...participants].sort((a, b) => {
      if (a.admin === "superadmin") return -1;
      if (b.admin === "superadmin") return 1;
      if (a.admin === "admin" && b.admin !== "admin") return -1;
      if (b.admin === "admin" && a.admin !== "admin") return 1;
      return 0;
    });
  }, [participants]);

  const formatParticipantId = (id: string): string => {
    return id.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");
  };

  const getParticipantDisplayName = (id: string): string => {
    // First check if we have a name from the database
    if (participantNames && participantNames[id]) {
      return participantNames[id];
    }
    // Fallback to formatted phone number
    return formatParticipantId(id);
  };

  const getRoleLabel = (admin: string | null): string | null => {
    if (admin === "superadmin") return "Criador";
    if (admin === "admin") return "Admin";
    return null;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: 320 },
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex flex-col">
            <Typography variant="h6" className="font-medium">
              Participantes
            </Typography>
            <Typography variant="body2" className="text-muted-foreground">
              {groupName ?? "Grupo WhatsApp"}
            </Typography>
          </div>
          <IconButton onClick={onClose} size="small">
            <i className="tabler-x !size-5" />
          </IconButton>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
          <i className="tabler-users !size-5 text-muted-foreground" />
          <Typography variant="body2" className="text-muted-foreground">
            {isLoading ? (
              <Skeleton variant="text" width={100} />
            ) : (
              `${participantCount} participantes`
            )}
          </Typography>
        </div>

        <List className="flex-1 overflow-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <ListItem key={index}>
                <ListItemAvatar>
                  <Skeleton variant="circular" width={40} height={40} />
                </ListItemAvatar>
                <ListItemText
                  primary={<Skeleton variant="text" width={120} />}
                  secondary={<Skeleton variant="text" width={80} />}
                />
              </ListItem>
            ))
          ) : sortedParticipants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <i className="tabler-users-group !size-12 mb-2 opacity-50" />
              <Typography variant="body2">Nenhum participante encontrado</Typography>
            </div>
          ) : (
            sortedParticipants.map((participant) => {
              const role = getRoleLabel(participant.admin);
              const phoneNumber = formatParticipantId(participant.id);
              const displayName = getParticipantDisplayName(participant.id);
              const hasName = displayName !== phoneNumber;
              return (
                <ListItem key={participant.id} className="hover:bg-gray-50">
                  <ListItemAvatar>
                    <Avatar className="bg-green-100 text-green-600">
                      <i className="tabler-user !size-5" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {role && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            {role}
                          </span>
                        )}
                      </div>
                    }
                    secondary={
                      <span className="text-xs text-muted-foreground">
                        {hasName ? phoneNumber : (participant.admin ? "Administrador" : "Membro")}
                      </span>
                    }
                  />
                </ListItem>
              );
            })
          )}
        </List>

        {groupInfo?.description && (
          <div className="p-4 border-t bg-gray-50">
            <Typography variant="caption" className="text-muted-foreground uppercase font-medium">
              Descrição do grupo
            </Typography>
            <Typography variant="body2" className="mt-1">
              {groupInfo.description}
            </Typography>
          </div>
        )}
      </div>
    </Drawer>
  );
}
