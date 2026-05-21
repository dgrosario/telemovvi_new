"use client";

import { PropsWithChildren, useId, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CustomTextField from "./custom-text-field";

type Props = {
  resourceName: string;
  dialogTitle?: string;
  dialogContent?: string;
  onConfirm?: () => void;
  hidden?: boolean;
  disabled?: boolean;
} & PropsWithChildren;

export default function ModalConfirmDelete(props: Props) {
  const id = useId();
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  if (props.hidden) {
    return <></>;
  }

  function onCopy() {
    const text = props.resourceName;
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  return (
    <>
      <div onClick={() => !props.disabled && setOpen(true)}>
        {props.children}
      </div>
      <Dialog fullWidth open={open} onClose={() => setOpen(false)}>
        <DialogTitle
          variant="h5"
          className="flex items-center gap-2 !text-red-500"
        >
          <i className="tabler-alert-circle" />
          {props.dialogTitle || "Tem certeza que deseja remover este recurso?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText className="!mb-2">
            {props.dialogContent ||
              `Esta ação não pode ser desfeita. Para confirmar, insira o nome do recurso para confirmar`}
          </DialogContentText>

          <CustomTextField
            disabled
            fullWidth
            label="Por favor, confirme a ação atual inserindo o nome do recurso abaixo"
            value={props.resourceName}
            slotProps={{
              input: {
                className: "mb-2",
                endAdornment: (
                  <IconButton onClick={onCopy} size="small">
                    <i className="tabler-copy !size-4" />
                  </IconButton>
                ),
              },
            }}
          />

          <CustomTextField
            tabIndex={0}
            id={id}
            fullWidth
            label="Recurso"
            onChange={(e) => setInputValue(e.target.value)}
          />
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
            color="error"
            disabled={inputValue !== props.resourceName}
            onClick={() => {
              props.onConfirm?.();
              setOpen(false);
            }}
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
