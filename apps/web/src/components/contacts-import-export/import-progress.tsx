"use client";

import { CircularProgress, Typography } from "@mui/material";
import type { ImportProgress as ImportProgressType } from "./types";

type Props = {
  progress: ImportProgressType;
};

export function ImportProgress({ progress }: Props) {
  if (!progress.isImporting) return null;

  const percentage = Math.round((progress.currentBatch / progress.totalBatches) * 100);

  return (
    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Typography variant="body2" className="font-medium text-blue-800">
          Importando contatos...
        </Typography>
        <CircularProgress size={20} />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Lote {progress.currentBatch} de {progress.totalBatches}</span>
          <span>{percentage}%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-green-600">✓ {progress.imported} novos</span>
        <span className="text-gray-600">⊘ {progress.skipped} já existem</span>
        {progress.updated > 0 && (
          <span className="text-blue-600">↻ {progress.updated} atualizados</span>
        )}
      </div>

      <Typography variant="caption" className="text-gray-600 block">
        Este processo pode levar até 5 minutos. Não feche esta janela.
      </Typography>
    </div>
  );
}
