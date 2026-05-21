"use client";

import { startImportJob } from "@/app/actions/partners/import-export-jobs";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { ExportTab } from "./export-tab";
import { ImportTab } from "./import-tab";
import type { ImportProgress, ParsedContact, TabValue } from "./types";
import { useProcessContacts } from "./use-process-contacts";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const ContactsImportExport: React.FC<Props> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabValue>("export");
  const [rawImportData, setRawImportData] = useState<ParsedContact[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const processedData = useProcessContacts(rawImportData);

  const importMutation = useServerActionMutation(startImportJob, {
    onSuccess: (data) => {
      const messages: string[] = [];
      if (data.imported > 0) messages.push(`${data.imported} importados`);
      if (data.skipped > 0) messages.push(`${data.skipped} já existiam`);

      toast.success(`✅ Importação concluída! ${messages.join(", ")}`);

      if (data.errors.length > 0) {
        console.error("Erros na importação:", data.errors);
        toast.warning(`${data.errors.length} contatos tiveram erros. Verifique o console.`);
      }

      queryClient.invalidateQueries({ queryKey: ["list-client"] });
      setRawImportData([]);
      setImportFileName("");
      setIsImporting(false);
      onClose();
    },
    onError: (error) => {
      console.error("[Import] Erro:", error);
      toast.error(`Erro ao importar: ${error.message}`);
      setIsImporting(false);
    },
  });

  const handleFileSelect = (data: ParsedContact[], fileName: string) => {
    setRawImportData(data);
    setImportFileName(fileName);
  };

  const resetImport = () => {
    setRawImportData([]);
    setImportFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (processedData.valid.length === 0) {
      toast.error("Nenhum contato válido para importar");
      return;
    }

    setIsImporting(true);

    const validContacts = processedData.valid.map((row) => ({
      name: row.name,
      phone: row.normalizedPhone || undefined,
      email: row.email,
      tags: row.tags,
      data_nascimento: row.data_nascimento,
      cep: row.cep,
      endereco: row.endereco,
      ...Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => !["name", "phone", "normalizedPhone", "phoneStatus", "email", "tags", "data_nascimento", "cep", "endereco"].includes(key)
        )
      ),
    }));

    toast.info(`Iniciando importação de ${validContacts.length} contatos. Você pode fechar esta janela.`);

    importMutation.mutate({ contacts: validContacts });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Importar / Exportar Contatos</DialogTitle>

      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          className="mb-4"
        >
          <Tab value="export" label="Exportar" />
          <Tab value="import" label="Importar" />
        </Tabs>

        {activeTab === "export" && <ExportTab />}

        {activeTab === "import" && (
          <ImportTab
            fileInputRef={fileInputRef}
            fileName={importFileName}
            processedData={processedData}
            importProgress={{ isImporting, currentBatch: 0, totalBatches: 0, imported: 0, updated: 0, skipped: 0, errors: [] }}
            onFileSelect={handleFileSelect}
            onReset={resetImport}
          />
        )}
      </DialogContent>

      <DialogActions className="!px-6 !py-4 border-t">
        <Button variant="outlined" onClick={onClose} disabled={isImporting}>
          {isImporting ? "Processando..." : "Fechar"}
        </Button>
        {activeTab === "import" && processedData.valid.length > 0 && !isImporting && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importMutation.isPending}
            startIcon={
              importMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <i className="tabler-upload" />
              )
            }
          >
            Importar {processedData.valid.length} contatos
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
