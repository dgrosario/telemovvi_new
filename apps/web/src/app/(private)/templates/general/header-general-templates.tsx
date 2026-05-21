"use client";

import { TitlePage } from "@/components/title-page";
import { useGeneralTemplates } from "@/hooks/use-general-templates";
import { Button } from "@mui/material";
import React from "react";

export default function HeaderGeneralTemplates() {
  const { toggleOpen } = useGeneralTemplates();
  return (
    <header className="pt-6 flex justify-between items-center px-6">
      <TitlePage>Modelos Gerais</TitlePage>
      <Button
        variant="contained"
        className="bg-teal-500"
        onClick={() => toggleOpen()}
      >
        Novo setor
      </Button>
    </header>
  );
}
