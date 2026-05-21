"use client";

import { Chip, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { usePartnersFilters } from "@/hooks/partners-filters-loader";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { Channel } from "@omnichannel/core/domain/entities/channel";

interface FiltersClientsProps {
  channels: Channel.Raw[];
}

// Alfabeto para navegação rápida
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export const FiltersClients: React.FC<FiltersClientsProps> = ({ channels }) => {
  const { channelFilters, setChannelFilters, query, setQuery } =
    usePartnersFilters();

  const [searchValue, setSearchValue] = useState(query);

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    startTransition(() => {
      setQuery(value);
    });
  }, 450);

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchValue(value);
      debouncedSetQuery(value);
    },
    [debouncedSetQuery]
  );

  const handleToggleChannel = useCallback(
    (channelId: string) => {
      if (channelFilters.includes(channelId)) {
        const newFilters = channelFilters.filter((id) => id !== channelId);
        setChannelFilters(newFilters);
      } else {
        setChannelFilters([...channelFilters, channelId]);
      }
    },
    [channelFilters, setChannelFilters]
  );

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <i className="tabler-brand-whatsapp size-4" />;
      case "instagram":
        return <i className="tabler-brand-instagram size-4" />;
      default:
        return <i className="tabler-message size-4" />;
    }
  };

  const getChannelColors = (type: string, isActive: boolean) => {
    if (!isActive) {
      return "bg-white text-gray-600 border-gray-300 hover:border-gray-400";
    }
    switch (type) {
      case "whatsapp":
        return "bg-green-500 text-white border-green-500";
      case "instagram":
        return "bg-rose-500 text-white border-rose-500";
      default:
        return "bg-gray-500 text-white border-gray-500";
    }
  };

  const channelsList = useMemo(() => {
    if (!channels) return [];
    const seen = new Set<string>();
    return channels.filter((channel) => {
      if (seen.has(channel.id)) return false;
      seen.add(channel.id);
      return true;
    });
  }, [channels]);

  return (
    <div className="mx-6 mt-4 p-4 border rounded-lg bg-white">
      <Stack direction="column" spacing={3}>
        {/* Barra de pesquisa estilo WhatsApp */}
        <TextField
          size="small"
          placeholder="Pesquisar nome ou número..."
          value={searchValue}
          onChange={handleSearchChange}
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              backgroundColor: '#f0f2f5',
              '& fieldset': {
                border: 'none',
              },
              '&:hover fieldset': {
                border: 'none',
              },
              '&.Mui-focused fieldset': {
                border: '1px solid #00a884',
              },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <i className="tabler-search size-5 text-gray-500" />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Filtros de canal */}
        {channelsList.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" className="text-gray-500 mr-2">
              Canais:
            </Typography>
            {channelsList.map((channel) => {
              const isActive = channelFilters.includes(channel.id);

              return (
                <Chip
                  key={channel.id}
                  icon={getChannelIcon(channel.type)}
                  label={channel.name}
                  onClick={() => handleToggleChannel(channel.id)}
                  variant={isActive ? "filled" : "outlined"}
                  className={`cursor-pointer transition-all ${getChannelColors(channel.type, isActive)}`}
                  size="small"
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </div>
  );
};
