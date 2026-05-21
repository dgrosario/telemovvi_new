"use client";

import { listPartners } from "@/app/actions/partners";
import { removePartners } from "@/app/actions/partners";
import { Column, TableDefault } from "@/components/table-default";
import { usePartnersFilters } from "@/hooks/partners-filters-loader";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useClients } from "@/hooks/use-clients";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { useUserPermissions } from "@/providers/user-permissions-provider";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import {
  Avatar,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Partner } from "@omnichannel/core/domain/entities/partner";
import { PartnerContact } from "@omnichannel/core/domain/entities/partner-contact";
import { useMemo } from "react";
import { Flip, toast } from "react-toastify";
import { getInstagramHandleForDisplay } from "@/utils/instagram-contact";

type Props = {
  clients: Partner.Raw[];
  totalPages: number;
  channels: Channel.Raw[];
};

function getAcronym(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "#00a884",
    "#53bdeb",
    "#7f66ff",
    "#ff7eb6",
    "#ffb347",
    "#87ceeb",
    "#98d8c8",
    "#f7dc6f",
    "#bb8fce",
    "#85c1e9",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function getContactDisplayValue(contact?: PartnerContact.Raw): string {
  if (!contact) return "";
  if (contact.type === "instagram") {
    return getInstagramHandleForDisplay(contact);
  }
  return contact.value;
}

export default function TableClients(props: Props) {
  const { toggleOpen, setClientId } = useClients();
  const { page, setPage, query, channelFilters } = usePartnersFilters();
  const { canViewContactDetailsForSector } = useUserPermissions();

  const { hasPermission: canRemove } = usePermissionCheck(
    PERMISSION_MAPPINGS.partners.remove,
  );

  const canViewContactDetails = canViewContactDetailsForSector(null);

  const removePartnerAction = useServerActionMutation(removePartners, {
    async onSuccess() {
      toast.success("Cliente removido com sucesso", {
        transition: Flip,
      });
    },
  });

  const { data, isFetching } = useServerActionQuery(listPartners, {
    input: {
      pageIndex: page,
      channelFilters,
      query,
    },
    queryKey: ["list-client", page, query, channelFilters.join(",")],
    initialData: {
      results: props.clients,
      totalPages: props.totalPages,
      pageIndex: page,
    },
    placeholderData: (previousData) => previousData,
  });

  const handleRowClick = (row: Partner.Raw) => {
    setClientId(row.id);
    toggleOpen();
  };

  const handleViewClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    row: Partner.Raw,
  ) => {
    e.stopPropagation();
    setClientId(row.id);
    toggleOpen();
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <i className="tabler-brand-whatsapp text-green-500 size-3.5" />;
      case "instagram":
        return <i className="tabler-brand-instagram text-rose-500 size-3.5" />;
      default:
        return <i className="tabler-message size-3.5" />;
    }
  };

  const columns = useMemo<Column<Partner.Raw>[]>(
    () => [
      {
        key: "name",
        label: "Contato",
        cell(_, row) {
          const contactList = row.contacts;
          const primaryContact = contactList[0];

          return (
            <div className="flex items-center gap-3 py-1">
              {/* Avatar estilo WhatsApp */}
              <Avatar
                sx={{
                  width: 45,
                  height: 45,
                  bgcolor: getAvatarColor(row.name),
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                {getAcronym(row.name)}
              </Avatar>

              {/* Nome e número */}
              <div className="flex flex-col min-w-0">
                <Typography
                  variant="body1"
                  className="font-medium text-gray-900 truncate"
                  sx={{ fontSize: "0.95rem" }}
                >
                  {row.name}
                </Typography>
                {canViewContactDetails && primaryContact && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    {getChannelIcon(primaryContact.type)}
                    <Typography variant="caption" className="text-gray-500">
                      {getContactDisplayValue(primaryContact)}
                    </Typography>
                  </div>
                )}
                {!canViewContactDetails && contactList.length > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    {getChannelIcon(contactList[0].type)}
                    <Typography variant="caption" className="text-gray-500">
                      Contato protegido
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "contacts",
        label: "Outros Contatos",
        cell(_, row) {
          const contactList = row.contacts;

          if (contactList.length <= 1) {
            return <span className="text-gray-400 text-sm">-</span>;
          }

          const otherContacts = contactList.slice(1);

          if (!canViewContactDetails) {
            const uniqueTypes = [...new Set(otherContacts.map((c) => c.type))];
            return (
              <div className="flex flex-wrap gap-1">
                {uniqueTypes.map((type) => (
                  <Tooltip key={type} title={type}>
                    <div
                      className="flex items-center justify-center px-2 py-0.5 bg-gray-100 rounded-full text-xs"
                    >
                      {getChannelIcon(type)}
                    </div>
                  </Tooltip>
                ))}
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-0.5">
              {otherContacts.slice(0, 2).map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-1.5 text-gray-500"
                >
                  {getChannelIcon(contact.type)}
                  <Typography variant="caption">
                    {getContactDisplayValue(contact)}
                  </Typography>
                </div>
              ))}
              {otherContacts.length > 2 && (
                <Typography variant="caption" className="text-gray-400">
                  +{otherContacts.length - 2} mais
                </Typography>
              )}
            </div>
          );
        },
      },
      {
        key: "createdAt",
        label: "Canais",
        cell(_, row) {
          const contactList = row.contacts;
          const channelsMap = new Map(props.channels.map((ch) => [ch.id, ch]));

          const uniqueChannels: Array<{
            key: string;
            label: string;
            type: string;
          }> = [];
          const seenKeys = new Set<string>();

          contactList.forEach((contact) => {
            if (contact.channelId) {
              const channel = channelsMap.get(contact.channelId);
              if (channel && !seenKeys.has(contact.channelId)) {
                seenKeys.add(contact.channelId);
                uniqueChannels.push({
                  key: contact.channelId,
                  label: channel.name,
                  type: channel.type,
                });
              }
            } else {
              const typeKey = `type-${contact.type}`;
              if (!seenKeys.has(typeKey)) {
                seenKeys.add(typeKey);
                uniqueChannels.push({
                  key: typeKey,
                  label: contact.type,
                  type: contact.type,
                });
              }
            }
          });

          return (
            <div className="flex flex-wrap gap-1">
              {uniqueChannels.map((ch) => (
                <Tooltip key={ch.key} title={ch.label}>
                  <div className="flex items-center justify-center px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {getChannelIcon(ch.type)}
                  </div>
                </Tooltip>
              ))}
            </div>
          );
        },
      },
      {
        key: "id",
        label: "",
        width: 60,
        cell: (_, row) => (
          <Tooltip title="Ver detalhes">
            <IconButton
              size="small"
              onClick={(e) => handleViewClick(e, row)}
              className="text-gray-400 hover:text-primary"
            >
              <i className="tabler-chevron-right size-5" />
            </IconButton>
          </Tooltip>
        ),
        stopPropagation: true,
      },
    ],
    [canViewContactDetails, props.channels],
  );

  const rows = useMemo(() => {
    const currentResults = data?.results ?? props.clients;
    return [...currentResults].sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.results, props.clients]);

  const totalPages = data?.totalPages ?? props.totalPages;

  return (
    <Paper elevation={0} className="m-6 border rounded-lg overflow-x-auto relative">
      {isFetching && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/90 px-2 py-1 shadow-sm">
          <CircularProgress size={14} />
          <span className="text-xs text-gray-500">Atualizando</span>
        </div>
      )}
      <TableDefault
        canSelect
        columns={columns}
        rows={rows}
        onRowClick={handleRowClick}
        onPageChange={(pageIndex) => setPage(pageIndex)}
        pageIndex={page}
        totalPages={totalPages}
        onRemove={
          canRemove
            ? (selecteds) => {
                removePartnerAction.mutate({
                  ids: selecteds.map((p) => p.id),
                });
              }
            : undefined
        }
      />
    </Paper>
  );
}
