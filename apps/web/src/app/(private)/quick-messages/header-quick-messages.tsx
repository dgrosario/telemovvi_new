"use client";

import { TitlePage } from "@/components/title-page";
import { useQuickMessages } from "@/hooks/use-quick-messages";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export default function HeaderQuickMessages() {
  const { toggleOpen } = useQuickMessages();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.quickMessages.create
  );

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Mensagens Rápidas</TitlePage>
      <PermissionTooltip hasPermission={hasPermission} message={tooltipMessage}>
        <Button
          variant="contained"
          className="bg-teal-500"
          onClick={() => toggleOpen()}
          disabled={!hasPermission}
        >
          Nova mensagem
        </Button>
      </PermissionTooltip>
    </header>
  );
}
