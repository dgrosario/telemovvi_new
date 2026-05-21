"use client";

import { getImportTemplate } from "@/app/actions/partners/import-export";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { Alert, Button, Typography } from "@mui/material";
import { RefObject, useCallback } from "react";
import { toast } from "react-toastify";
import { ContactsPreview } from "./contacts-preview";
import { FileUpload } from "./file-upload";
import { ImportProgress } from "./import-progress";
import type { ImportProgress as ImportProgressType, ParsedContact, ProcessedData } from "./types";
import { normalizePhoneBR, parseCSVLine } from "./utils";
import { ValidationSummary } from "./validation-summary";

type Props = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  processedData: ProcessedData;
  importProgress: ImportProgressType;
  onFileSelect: (data: ParsedContact[], fileName: string) => void;
  onReset: () => void;
};

export function ImportTab({
  fileInputRef,
  fileName,
  processedData,
  importProgress,
  onFileSelect,
  onReset,
}: Props) {
  const { data: templateData } = useServerActionQuery(getImportTemplate, {
    input: undefined,
    queryKey: ["import-template"],
    enabled: true,
  });

  const handleDownloadTemplate = () => {
    if (!templateData) return;

    const csvContent = [
      templateData.headers.join(";"),
      templateData.exampleRow
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(";"),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_importacao_contatos.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Template baixado!");
  };

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          toast.error("Arquivo vazio ou sem dados");
          return;
        }

        const firstLine = lines[0] || "";
        const separator = firstLine.includes(";") ? ";" : ",";

        const headers = parseCSVLine(firstLine, separator).map((h) =>
          h.toLowerCase().trim()
        );

        const data: ParsedContact[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line?.trim()) continue;

          const values = parseCSVLine(line, separator);
          const row: Record<string, string> = {};

          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || "";
          });

          const name = row["nome"] || row["name"] || "";
          const phone = row["telefone"] || row["phone"] || row["celular"] || "";
          const email = row["email"] || row["e-mail"] || "";
          const tags = row["tags"] || row["etiquetas"] || "";
          const dataNascimento = row["data_nascimento"] || row["nascimento"] || row["birthday"] || "";
          const cep = row["cep"] || "";
          const endereco = row["endereco"] || row["endereço"] || row["address"] || "";

          if (!name) continue;

          const { normalized, status } = normalizePhoneBR(phone);

          const contact: ParsedContact = {
            name,
            phone,
            normalizedPhone: normalized,
            phoneStatus: status,
            email,
            tags,
            data_nascimento: dataNascimento,
            cep,
            endereco,
          };

          const fixedFields = ["nome", "name", "telefone", "phone", "celular", "email", "e-mail", 
            "tags", "etiquetas", "data_nascimento", "nascimento", "birthday", "cep", "endereco", "endereço", "address"];
          for (const [key, value] of Object.entries(row)) {
            if (!fixedFields.includes(key) && value) {
              contact[key] = value;
            }
          }

          data.push(contact);
        }

        onFileSelect(data, file.name);
        toast.info(`${data.length} contatos encontrados no arquivo`);
      };

      reader.readAsText(file, "UTF-8");
    },
    [onFileSelect]
  );

  return (
    <div className="space-y-4">
      <Typography variant="body1">
        Importe contatos de um arquivo CSV ou Excel.
      </Typography>

      <Alert severity="success" className="mb-4">
        <Typography variant="body2" className="font-medium mb-2">
          ✨ Importação em Background
        </Typography>
        <Typography variant="body2">
          A importação é processada no servidor. Você pode fechar esta janela e continuar usando o sistema normalmente.
        </Typography>
      </Alert>

      {templateData && (
        <Alert severity="info" className="mb-4">
          <Typography variant="body2" className="font-medium mb-2">
            Instruções:
          </Typography>
          <ul className="list-disc list-inside text-sm">
            {templateData.instructions.map((instruction, i) => (
              <li key={i}>{instruction}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          variant="outlined"
          onClick={handleDownloadTemplate}
          startIcon={<i className="tabler-file-download" />}
        >
          Baixar Template
        </Button>
      </div>

      <FileUpload
        fileInputRef={fileInputRef}
        fileName={fileName}
        onFileSelect={handleFileSelect}
        onReset={onReset}
      />

      {processedData.total > 0 && (
        <>
          <ValidationSummary data={processedData} />
          <ContactsPreview contacts={processedData.valid} type="valid" />
          <ContactsPreview contacts={processedData.invalid} type="invalid" />
          <ContactsPreview contacts={processedData.emptyPhone} type="empty" />
        </>
      )}

      <ImportProgress progress={importProgress} />
    </div>
  );
}
