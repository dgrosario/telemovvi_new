"use client";
import { TitlePage } from "@/components/title-page";
import { useSectors } from "@/hooks/use-sectors";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export const HeaderSectors: React.FC = () => {
  const { toggleOpen } = useSectors();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.sectors.create
  );

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Setores</TitlePage>
      <PermissionTooltip hasPermission={hasPermission} message={tooltipMessage}>
        <Button
          variant="contained"
          className="bg-teal-500"
          onClick={() => toggleOpen()}
          disabled={!hasPermission}
        >
          Novo setor
        </Button>
      </PermissionTooltip>
    </header>
  );
};
