"use client";
import { TitlePage } from "@/components/title-page";
import { useSystemVariablesDialog } from "@/hooks/use-system-variables";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export const HeaderVariables: React.FC = () => {
  const { toggleOpen } = useSystemVariablesDialog();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.variables.create
  );

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Variáveis</TitlePage>
      <PermissionTooltip hasPermission={hasPermission} message={tooltipMessage}>
        <Button
          variant="contained"
          onClick={() => toggleOpen()}
          disabled={!hasPermission}
        >
          Nova variável
        </Button>
      </PermissionTooltip>
    </header>
  );
};
