"use client";

import { Button, Typography, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Chat Error]", error);
  }, [error]);

  return (
    <Box className="h-screen flex flex-col items-center justify-center gap-4 p-6">
      <ErrorOutlineIcon sx={{ fontSize: 64, color: "error.main" }} />
      <Typography variant="h5" className="font-semibold">
        Erro ao carregar o chat
      </Typography>
      <Typography color="text.secondary" className="text-center max-w-md">
        Ocorreu um erro ao carregar a p&aacute;gina de conversas. Tente limpar
        os filtros ou recarregar a p&aacute;gina.
      </Typography>
      {error.digest && (
        <Typography variant="caption" color="text.secondary">
          ID do erro: {error.digest}
        </Typography>
      )}
      <Box className="flex gap-2">
        <Button variant="outlined" onClick={() => router.push("/chat")}>
          Limpar filtros
        </Button>
        <Button variant="contained" onClick={reset}>
          Tentar novamente
        </Button>
      </Box>
    </Box>
  );
}
