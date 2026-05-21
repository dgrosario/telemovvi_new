"use client";

import { Button, Typography, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useRouter } from "next/navigation";

export default function FlowEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <Box className="h-screen flex flex-col items-center justify-center gap-4 p-6">
      <ErrorOutlineIcon sx={{ fontSize: 64, color: "error.main" }} />
      <Typography variant="h5" className="font-semibold">
        Erro ao carregar o editor de fluxos
      </Typography>
      <Typography color="text.secondary" className="text-center max-w-md">
        {error.message || "Ocorreu um erro inesperado ao carregar o editor de fluxos."}
      </Typography>
      {error.digest && (
        <Typography variant="caption" color="text.secondary">
          ID do erro: {error.digest}
        </Typography>
      )}
      <Box className="flex gap-2">
        <Button variant="outlined" onClick={() => router.push("/flows")}>
          Voltar para Fluxos
        </Button>
        <Button variant="contained" onClick={reset}>
          Tentar novamente
        </Button>
      </Box>
    </Box>
  );
}
