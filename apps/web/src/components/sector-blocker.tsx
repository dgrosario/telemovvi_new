"use client";

import { Chip, Collapse, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

type Sector = {
  id: string;
  name: string;
};

type SectorBlockerProps = {
  isVisible: boolean;
  sectors: Sector[];
  blockedSectorIds: Set<string>;
  onToggle: (sectorId: string) => void;
  context: "role" | "user";
};

export function SectorBlocker({
  isVisible,
  sectors,
  blockedSectorIds,
  onToggle,
  context,
}: SectorBlockerProps) {
  const contextText =
    context === "role" ? "usuários com este perfil" : "este usuário";

  const blockedSectorNames = Array.from(blockedSectorIds)
    .map((id) => sectors.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  return (
    <Collapse in={isVisible}>
      <div className="ml-4 mr-12 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
        <Typography variant="body2" className="text-gray-600 mb-2">
          Selecione os setores que {contextText}{" "}
          <strong>NÃO</strong> poderá visualizar os dados do contato:
        </Typography>
        <div className="flex flex-wrap gap-2">
          {sectors.map((sector) => {
            const isBlocked = blockedSectorIds.has(sector.id);
            return (
              <Chip
                key={sector.id}
                label={sector.name}
                onClick={() => onToggle(sector.id)}
                color={isBlocked ? "error" : "default"}
                variant={isBlocked ? "filled" : "outlined"}
                size="small"
                className="cursor-pointer"
                icon={
                  isBlocked ? (
                    <Icon icon="tabler:lock" className="!text-white" />
                  ) : undefined
                }
              />
            );
          })}
          {sectors.length === 0 && (
            <Typography variant="caption" className="text-gray-400">
              Nenhum setor cadastrado
            </Typography>
          )}
        </div>
        <Typography variant="caption" className="text-gray-500 mt-2 block">
          {blockedSectorIds.size === 0
            ? "Nenhum setor bloqueado = pode ver dados de contatos em todos os setores"
            : `NÃO poderá ver dados de contatos nos setores: ${blockedSectorNames}`}
        </Typography>
      </div>
    </Collapse>
  );
}
