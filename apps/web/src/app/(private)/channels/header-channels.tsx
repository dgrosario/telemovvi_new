"use client";
import { TitlePage } from "@/components/title-page";
import { useChannels } from "@/hooks/use-channels";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export const HeaderChannels: React.FC = () => {
  const { openRegisterModal } = useChannels();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.channels.create
  );

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Canais</TitlePage>
      <PermissionTooltip hasPermission={hasPermission} message={tooltipMessage}>
        <Button
          variant="contained"
          onClick={() => openRegisterModal()}
          disabled={!hasPermission}
        >
          Novo canal
        </Button>
      </PermissionTooltip>
    </header>
  );
};
