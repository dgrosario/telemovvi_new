"use client";
import { Badge, IconButton, Stack, Tooltip } from "@mui/material";
import React from "react";
import SortIcon from "@mui/icons-material/Sort";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import BusinessIcon from "@mui/icons-material/Business";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import type { ChatAttendant } from "@/types/chat-attendant";

interface QuickFiltersBarProps {
  sectors: Sector.Props[];
  users: ChatAttendant[];
  hasSectorFilter: boolean;
  hasUserFilter: boolean;
  sortOrder: "desc" | "asc";
  waitingStatus: "attendant" | "client" | "";
  showAll: boolean;
  canViewAll: boolean;
  showAttendantFilter: boolean;
  completeAllLabel?: string;
  showCompleteAll?: boolean;
  onSectorClick: (event: React.MouseEvent<HTMLElement>) => void;
  onUserClick: (event: React.MouseEvent<HTMLElement>) => void;
  onSortToggle: () => void;
  onWaitingToggle: (status: "attendant" | "client") => void;
  onShowAllToggle: () => void;
  onCompleteAll: () => void;
  onClearAllFilters: () => void;
}

// Componente de botão com label para mobile
interface FilterButtonProps {
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  tooltip: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  hasBadge?: boolean;
  activeColor?: "primary" | "success" | "warning";
}

const FilterButton: React.FC<FilterButtonProps> = ({
  onClick,
  tooltip,
  label,
  icon,
  isActive = false,
  hasBadge = false,
  activeColor = "primary",
}) => {
  const colorMap = {
    primary: {
      border: "primary.main",
      bg: "primary.main",
      hoverBg: "primary.dark",
    },
    success: {
      border: "success.main",
      bg: "success.light",
      hoverBg: "success.light",
    },
    warning: {
      border: "warning.main",
      bg: "warning.light",
      hoverBg: "warning.light",
    },
  };

  const colors = colorMap[activeColor];

  return (
    <Tooltip title={tooltip} arrow>
      <div className="flex flex-col items-center gap-0.5">
        <IconButton
          onClick={onClick}
          sx={{
            border: "1px solid",
            borderColor: isActive ? colors.border : "divider",
            borderRadius: "8px",
            padding: "8px",
            bgcolor: isActive ? colors.bg : "transparent",
            color: isActive ? "white" : "inherit",
            "&:hover": {
              borderColor: colors.border,
              bgcolor: isActive ? colors.hoverBg : "action.hover",
            },
          }}
        >
          <Badge variant="dot" color="primary" invisible={!hasBadge}>
            {icon}
          </Badge>
        </IconButton>
        <span className="text-[10px] text-gray-500 md:hidden leading-tight">
          {label}
        </span>
      </div>
    </Tooltip>
  );
};

export const QuickFiltersBar: React.FC<QuickFiltersBarProps> = ({
  sectors,
  users,
  hasSectorFilter,
  hasUserFilter,
  sortOrder,
  waitingStatus,
  showAll,
  canViewAll,
  showAttendantFilter,
  completeAllLabel = "Concluir todas as conversas abertas",
  showCompleteAll = true,
  onSectorClick,
  onUserClick,
  onSortToggle,
  onWaitingToggle,
  onShowAllToggle,
  onCompleteAll,
  onClearAllFilters,
}) => {
  return (
    <div className="flex flex-col gap-1">
      {/* Título "Filtrar" apenas no mobile */}
      <span className="text-xs font-medium text-gray-500 px-2 md:hidden">
        Filtrar
      </span>
      <div 
        className="overflow-x-auto px-2 md:px-4 py-0.5 scrollbar-hide"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 1 }}
          alignItems="flex-start"
          sx={{ minWidth: "max-content", pr: 2 }}
        >
      {/* Setores */}
      <FilterButton
        onClick={onSectorClick}
        tooltip="Filtrar por setor"
        label="Setor"
        icon={<BusinessIcon sx={{ fontSize: "1.25rem" }} />}
        hasBadge={hasSectorFilter}
      />

      {/* Atendentes */}
      {showAttendantFilter && (
        <FilterButton
          onClick={onUserClick}
          tooltip="Filtrar por atendente"
          label="Atendente"
          icon={<SupportAgentIcon sx={{ fontSize: "1.25rem" }} />}
          hasBadge={hasUserFilter}
        />
      )}

      {/* Ordenação */}
      <FilterButton
        onClick={onSortToggle}
        tooltip={sortOrder === "desc" ? "Mais recentes primeiro" : "Mais antigas primeiro"}
        label={sortOrder === "desc" ? "Recentes" : "Antigas"}
        icon={
          <SortIcon
            sx={{
              fontSize: "1.25rem",
              transform: sortOrder === "asc" ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        }
      />

      {/* Aguardando Atendente */}
      <FilterButton
        onClick={() => onWaitingToggle("attendant")}
        tooltip="Cliente aguardando resposta"
        label="S/ Resposta"
        icon={<HourglassEmptyIcon sx={{ fontSize: "1.25rem" }} />}
        isActive={waitingStatus === "attendant"}
      />

      {/* Aguardando Cliente */}
      <FilterButton
        onClick={() => onWaitingToggle("client")}
        tooltip="Atendente aguardando resposta do cliente"
        label="Ag. Cliente"
        icon={<PersonIcon sx={{ fontSize: "1.25rem" }} />}
        isActive={waitingStatus === "client"}
      />

      {/* Mostrar Todas - só com permissão */}
      {canViewAll && (
        <FilterButton
          onClick={onShowAllToggle}
          tooltip="Mostrar todas as conversas (outros atendentes)"
          label="Ver Todas"
          icon={<VisibilityIcon sx={{ fontSize: "1.25rem" }} />}
          isActive={showAll}
        />
      )}

      {/* Concluir todas as conversas */}
      {showCompleteAll && (
        <FilterButton
          onClick={() => {
            if (confirm(`${completeAllLabel}?`)) {
              onCompleteAll();
            }
          }}
          tooltip={completeAllLabel}
          label="Concluir"
          icon={<DoneAllIcon sx={{ fontSize: "1.25rem" }} />}
          activeColor="success"
        />
      )}

      {/* Limpar todos os filtros */}
      <FilterButton
        onClick={onClearAllFilters}
        tooltip="Limpar todos os filtros"
        label="Limpar"
        icon={<FilterAltOffIcon sx={{ fontSize: "1.25rem" }} />}
        activeColor="warning"
      />
    </Stack>
      </div>
    </div>
  );
};
