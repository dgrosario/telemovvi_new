"use client";

import { Box, Button, Container, Typography } from "@mui/material";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          textAlign: "center",
          gap: 3,
        }}
      >
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            bgcolor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <Shield size={60} color="white" />
        </Box>

        <Typography variant="h3" component="h1" fontWeight="bold">
          Acesso Negado
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
          Você não possui permissão para acessar esta página. Entre em contato
          com o administrador do sistema se acredita que isso é um erro.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            size="large"
            component={Link}
            href="/conversations"
          >
            Voltar ao Dashboard
          </Button>
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ mt: 4 }}>
          Erro 403 - Acesso Proibido
        </Typography>
      </Box>
    </Container>
  );
}
