"use client";
import { Badge, IconButton, Stack, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import { Channel, typeChannelsAvailable } from "@omnichannel/core/domain/entities/channel";

interface ChannelQuickFiltersProps {
  channels: Channel.Raw[];
  activeChannelIds: string[];
  onChannelToggle: (channelId: string) => void;
}

export const ChannelQuickFilters: React.FC<ChannelQuickFiltersProps> = ({
  channels,
  activeChannelIds,
  onChannelToggle,
}) => {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {channels.map((channel) => {
        const channelType = typeChannelsAvailable.get(channel.type);
        const isActive = activeChannelIds.includes(channel.id);
        const iconName = channelType?.icon.split(" ")[0] ?? "tabler:message";

        return (
          <Tooltip key={channel.id} title={channel.name} arrow>
            <IconButton
              onClick={() => onChannelToggle(channel.id)}
              sx={{
                border: "1px solid",
                borderColor: isActive ? "primary.main" : "divider",
                borderRadius: "8px",
                padding: "8px",
                bgcolor: isActive ? "action.selected" : "transparent",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: isActive ? "action.selected" : "action.hover",
                },
              }}
            >
              <Badge variant="dot" color="primary" invisible={!isActive}>
                <Icon icon={iconName} width={20} height={20} />
              </Badge>
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
