"use client";
import { TitlePage } from "@/components/title-page";
import { ContactsImportExport } from "@/components/contacts-import-export";
import { useClients } from "@/hooks/use-clients";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { PermissionTooltip } from "@/components/permission-tooltip";
import { PERMISSION_MAPPINGS } from "@/lib/permissions-map";
import { Button, Stack } from "@mui/material";
import { useState } from "react";

export const HeaderClients: React.FC = () => {
  const { toggleOpen } = useClients();
  const { hasPermission, tooltipMessage } = usePermissionCheck(
    PERMISSION_MAPPINGS.partners.create
  );
  const [importExportOpen, setImportExportOpen] = useState(false);

  return (
    <header className="pt-6 px-6">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <TitlePage>Clientes</TitlePage>
        <Stack direction="row" spacing={2}>
          <PermissionTooltip
            hasPermission={hasPermission}
            message={tooltipMessage}
          >
            <Button
              variant="outlined"
              onClick={() => setImportExportOpen(true)}
              disabled={!hasPermission}
              startIcon={<i className="tabler-file-import" />}
            >
              Importar / Exportar
            </Button>
          </PermissionTooltip>
          <PermissionTooltip
            hasPermission={hasPermission}
            message={tooltipMessage}
          >
            <Button
              variant="contained"
              className="bg-teal-500"
              onClick={() => toggleOpen()}
              disabled={!hasPermission}
            >
              Novo cliente
            </Button>
          </PermissionTooltip>
        </Stack>
      </Stack>

      <ContactsImportExport
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
      />
    </header>
  );
};
