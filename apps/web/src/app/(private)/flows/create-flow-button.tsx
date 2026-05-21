"use client";

import { Button } from "@mui/material";
import { useState } from "react";
import { CreateFlowDialog } from "./create-flow-dialog";

export function CreateFlowButton() {
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <>
      <Button
        variant="contained"
        startIcon={<i className="tabler-plus" />}
        onClick={() => setOpenDialog(true)}
      >
        Novo Fluxo
      </Button>
      <CreateFlowDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
      />
    </>
  );
}
