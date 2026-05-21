"use client";

import { Button, Typography } from "@mui/material";
import { RefObject } from "react";

type Props = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
};

export function FileUpload({ fileInputRef, fileName, onFileSelect, onReset }: Props) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={onFileSelect}
        className="hidden"
      />

      {fileName ? (
        <div className="space-y-2">
          <i className="tabler-file-check text-4xl text-green-500" />
          <Typography variant="body1" className="font-medium">
            {fileName}
          </Typography>
          <Button variant="text" size="small" onClick={onReset}>
            Remover arquivo
          </Button>
        </div>
      ) : (
        <div
          className="cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <i className="tabler-upload text-4xl text-gray-400" />
          <Typography variant="body1" className="mt-2">
            Clique para selecionar um arquivo
          </Typography>
          <Typography variant="body2" className="text-gray-500">
            CSV ou Excel (.csv, .xlsx, .xls)
          </Typography>
        </div>
      )}
    </div>
  );
}
