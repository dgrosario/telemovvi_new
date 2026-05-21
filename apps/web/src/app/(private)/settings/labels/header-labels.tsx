"use client";

import { TitlePage } from "@/components/title-page";
import { useLabelsDialog } from "@/hooks/use-labels";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button } from "@mui/material";

export const HeaderLabels: React.FC = () => {
  const { toggleOpen, setId } = useLabelsDialog();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.labels.create
  );

  const handleNew = () => {
    setId("");
    toggleOpen();
  };

  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Etiquetas</TitlePage>
      <PermissionTooltip hasPermission={hasPermission} message={tooltipMessage}>
        <Button
          variant="contained"
          onClick={handleNew}
          disabled={!hasPermission}
        >
          Nova etiqueta
        </Button>
      </PermissionTooltip>
    </header>
  );
};
