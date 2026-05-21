"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { PropsWithChildren, useState } from "react";

type Props = {
  title?: string;
  content?: string;
  onConfirm?: () => void;
  hidden?: boolean;
} & PropsWithChildren;

export default function ModalConfirm(props: Props) {
  const [open, setOpen] = useState(false);

  if (props.hidden) {
    return <></>;
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{props.children}</div>
      <Dialog fullWidth open={open} onClose={() => setOpen(false)}>
        <DialogTitle
          variant="h5"
          className="flex items-center gap-2 !text-primary"
        >
          {props.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="!mb-2">
            {props.content}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outlined"
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => {
              props.onConfirm?.();
              setOpen(false);
            }}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
