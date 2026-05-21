"use client";

import { startExportJob } from "@/app/actions/partners/import-export-jobs";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { Button, CircularProgress, Typography } from "@mui/material";
import { toast } from "react-toastify";

export function ExportTab() {
  const exportMutation = useServerActionMutation(startExportJob, {
    onSuccess: (data) => {
      toast.success(`${data.totalContacts} contatos exportados!`);
      
      // Fazer download do arquivo
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: (error) => {
      toast.error(`Erro ao exportar: ${error.message}`);
    },
  });

  return (
    <div className="space-y-4">
      <Typography variant="body1">
        Exporte todos os seus contatos para um arquivo CSV.
      </Typography>
      <Typography variant="body2" className="text-gray-600">
        O arquivo incluirá: nome, telefone, data de nascimento, CEP, endereço, tags e variáveis customizadas.
      </Typography>
      <Typography variant="body2" className="text-blue-600">
        A exportação é processada no servidor. Você pode fechar esta janela e o arquivo será gerado.
      </Typography>

      <Button
        variant="contained"
        onClick={() => exportMutation.mutate(undefined)}
        disabled={exportMutation.isPending}
        startIcon={
          exportMutation.isPending ? (
            <CircularProgress size={20} />
          ) : (
            <i className="tabler-download" />
          )
        }
      >
        {exportMutation.isPending ? "Exportando..." : "Exportar CSV"}
      </Button>
    </div>
  );
}
