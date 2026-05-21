"use client";

import { useConversationFilters } from "@/hooks/conversation-filters-loader";
import { LabelsSelector } from "@/components/labels-selector";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import type { ChatAttendant } from "@/types/chat-attendant";
import { Icon } from "@iconify/react";
import React, { useState } from "react";
import CustomTextField from "@/components/custom-text-field";
import { SmartSearchFilter } from "./smart-search-filter";
import { DateRangeFilter } from "./date-range-filter";
import type { SearchType } from "@/hooks/use-smart-search";

interface FilterConversationsDrawerProps {
  channelsList: Channel.Raw[];
  sectorsList: Sector.Props[];
  usersList: ChatAttendant[];
  canFilterByAttendant: boolean;
}

export function FilterConversationsDrawer({
  channelsList,
  sectorsList,
  usersList,
  canFilterByAttendant,
}: FilterConversationsDrawerProps) {
  const {
    channels,
    users,
    onChange,
    sectors,
    labels,
    filters,
    clearAllFilters,
    dateRange,
    dateType,
    setDateRange,
    setDateType,
    query,
    setQuery,
    searchType,
    setSearchType,
    showAll,
    setShowAll,
  } = useConversationFilters();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);

  const totalFilters =
    filters.channelFilters.length +
    filters.sectorFilters.length +
    filters.userFilters.length +
    filters.labelFilters.length +
    (dateRange.start && dateRange.end ? 1 : 0) +
    (query ? 1 : 0);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    handleClose();
  };

  const handleClearAll = () => {
    clearAllFilters();
  };

  const handleSmartSearchChange = (value: string, type: SearchType) => {
    setQuery(value);
    setSearchType(type);
  };

  return (
    <>
      <Tooltip title="Filtros avançados" arrow>
        <Badge variant="standard" color="error" badgeContent={totalFilters}>
          <IconButton onClick={handleClick}>
            <Icon icon="tabler-adjustments-horizontal" width={24} height={24} />
          </IconButton>
        </Badge>
      </Tooltip>

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
            sx: {
              mt: 1,
              width: { xs: "calc(100vw - 32px)", sm: 380 },
              maxWidth: 380,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        <Box px={2.5} py={2} borderBottom="1px solid" borderColor="divider">
          <Typography variant="h6" fontWeight={600}>
            Filtros Avançados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure os filtros para encontrar conversas específicas
          </Typography>
        </Box>

        <Box flex={1} overflow="auto" px={1} py={1}>
          <div className="space-y-1">
            <Accordion defaultExpanded disableGutters elevation={0}>
              <AccordionSummary
                expandIcon={<Icon icon="tabler-chevron-down" width={20} />}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="tabler-search" width={20} />
                  <span className="font-medium text-sm">Busca Inteligente</span>
                </div>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <SmartSearchFilter
                  value={query}
                  searchType={searchType}
                  onChange={handleSmartSearchChange}
                />
              </AccordionDetails>
            </Accordion>

            <Accordion disableGutters elevation={0}>
              <AccordionSummary
                expandIcon={<Icon icon="tabler-chevron-down" width={20} />}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="tabler-calendar" width={20} />
                  <span className="font-medium text-sm">Período</span>
                </div>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <DateRangeFilter
                  dateType={dateType}
                  dateStart={dateRange.start || ""}
                  dateEnd={dateRange.end || ""}
                  onDateTypeChange={setDateType}
                  onDateRangeChange={setDateRange}
                />
              </AccordionDetails>
            </Accordion>

            <Accordion disableGutters elevation={0}>
              <AccordionSummary
                expandIcon={<Icon icon="tabler-chevron-down" width={20} />}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="tabler-building-store" width={20} />
                  <span className="font-medium text-sm">Canais e Setores</span>
                </div>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <div className="space-y-3">
                  <Autocomplete
                    multiple
                    size="small"
                    options={channelsList}
                    value={channelsList.filter((c) => channels.includes(c.id))}
                    onChange={(_, newValue) =>
                      onChange(
                        "channel",
                        (newValue || []).map((c) => c.id)
                      )
                    }
                    getOptionLabel={(option) => option.name}
                    renderInput={(params) => (
                      <CustomTextField
                        {...params}
                        label="Canais"
                        size="small"
                      />
                    )}
                    noOptionsText="Nenhum canal encontrado"
                  />
                  <Autocomplete
                    multiple
                    size="small"
                    options={sectorsList}
                    value={sectorsList.filter((s) => sectors.includes(s.id))}
                    onChange={(_, newValue) =>
                      onChange(
                        "sector",
                        (newValue || []).map((s) => s.id)
                      )
                    }
                    getOptionLabel={(option) => option.name}
                    renderInput={(params) => (
                      <CustomTextField
                        {...params}
                        label="Setores"
                        size="small"
                      />
                    )}
                    noOptionsText="Nenhum setor encontrado"
                  />
                </div>
              </AccordionDetails>
            </Accordion>

            <Accordion disableGutters elevation={0}>
              <AccordionSummary
                expandIcon={<Icon icon="tabler-chevron-down" width={20} />}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="tabler-tag" width={20} />
                  <span className="font-medium text-sm">Etiquetas</span>
                </div>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <LabelsSelector
                  value={labels}
                  onChange={(newValue) => onChange("label", newValue)}
                  label="Etiquetas"
                  placeholder="Selecione etiquetas..."
                />
              </AccordionDetails>
            </Accordion>

            {canFilterByAttendant && (
              <Accordion disableGutters elevation={0}>
                <AccordionSummary
                  expandIcon={<Icon icon="tabler-chevron-down" width={20} />}
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="tabler-users" width={20} />
                    <span className="font-medium text-sm">Atendentes</span>
                  </div>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={usersList}
                    value={usersList.filter((u) => users.includes(u.id))}
                    onChange={(_, newValue) => {
                      const nextUserIds = (newValue || []).map((u) => u.id);
                      onChange("user", nextUserIds);

                      // Backend só aplica filtro por atendente quando showAll=true.
                      if (nextUserIds.length > 0 && !showAll) {
                        setShowAll(true);
                      }
                    }}
                    getOptionLabel={(option) => option.name}
                    renderInput={(params) => (
                      <CustomTextField
                        {...params}
                        label="Atendentes"
                        size="small"
                      />
                    )}
                    noOptionsText="Nenhum atendente encontrado"
                  />
                </AccordionDetails>
              </Accordion>
            )}
          </div>
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          px={2.5}
          py={2}
          borderTop="1px solid"
          borderColor="divider"
        >
          <Button
            variant="outlined"
            onClick={handleClearAll}
            fullWidth
            size="medium"
          >
            Limpar tudo
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            fullWidth
            size="medium"
          >
            Aplicar filtros
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
