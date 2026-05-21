"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversationFilters } from "@/hooks/conversation-filters-loader";
import { Badge, Button, Divider, IconButton, Typography } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Sector } from "@omnichannel/core/domain/entities/sector";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";
import CustomTextField from "../custom-text-field";
import { UserListed } from "@omnichannel/core/infra/repositories/users-repository";

type Props = {
  channelsList: Channel.Props[];
  sectorsList: Sector.Props[];
  usersList: UserListed[];
  permissions: PolicyName[];
};

export function FilterConversations({
  channelsList,
  sectorsList,
  usersList,
  permissions,
}: Props) {
  const { channels, users, onChange, sectors, filters, clearFilters } =
    useConversationFilters();

  const hasListAllConversations = permissions.includes("list:all-conversations");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="standard"
          color="error"
          badgeContent={
            filters.channelFilters.length +
            filters.sectorFilters.length +
            filters.userFilters.length
          }
        >
          <IconButton>
            <i className="tabler-adjustments-horizontal" />
          </IconButton>
        </Badge>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="flex w-[calc(100vw-2rem)] max-w-[25rem] flex-col gap-4 rounded-lg border border-gray-300 bg-white p-4 sm:p-5 shadow-sm"
      >
        {/* --- Filtro STATUS --- */}
        <div className="flex flex-col flex-1">
          <Typography variant="h6" className="pb-2 flex gap-3 items-center">
            <i className="tabler-filter !size-4" />
            Filtros
          </Typography>
          <Divider />
          <Autocomplete
            multiple
            disablePortal
            className="mt-4 w-full"
            hidden={!hasListAllConversations}
            options={usersList}
            value={usersList.filter((s) => users.includes(s.id))}
            onChange={(_, newValue) =>
              onChange(
                "user",
                (newValue || []).map((s) => s.id)
              )
            }
            renderInput={(params) => (
              <CustomTextField {...params} label="Por atendente" size="small" />
            )}
            getOptionLabel={(option) => option.name}
            noOptionsText="Nenhum resultado encontrado"
          />
          <Autocomplete
            multiple
            disablePortal
            className="mt-4 w-full"
            options={sectorsList}
            value={sectorsList.filter((s) => sectors.includes(s.id))}
            onChange={(_, newValue) =>
              onChange(
                "sector",
                (newValue || []).map((s) => s.id)
              )
            }
            renderInput={(params) => (
              <CustomTextField {...params} label="Por setor" size="small" />
            )}
            getOptionLabel={(option) => option.name}
            noOptionsText="Nenhum resultado encontrado"
          />
          <Autocomplete
            multiple
            disablePortal
            className="mt-4 w-full"
            options={channelsList}
            value={channelsList.filter((s) => channels.includes(s.id))}
            onChange={(_, newValue) =>
              onChange(
                "channel",
                (newValue || []).map((c) => c.id)
              )
            }
            getOptionLabel={(option) => option.name}
            renderInput={(params) => (
              <CustomTextField {...params} label="Por canal" size="small" />
            )}
            noOptionsText="Nenhum resultado encontrado"
          />
        </div>

        {/* --- Botões --- */}
        <div className="flex justify-end gap-2 w-full pt-3 border-t border-gray-200">
          <Button
            onClick={clearFilters}
            variant="outlined"
            size="small"
            className="text-gray-600 hover:text-gray-800"
          >
            Limpar
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
