"use client";
import { Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "react-toastify";

type Props = {
  workspaceId: string;
};

export const ButtonCopyIdWorkspace = (props: Props) => {
  const copyIdToClipboard = () => {
    navigator.clipboard
      .writeText(props.workspaceId)
      .then(() => {
        toast.success("Copiada para área de transferência");
      })
      .catch((err) => console.error("Erro ao copiar:", err));
  };
  return (
    <Button
      title="Copiar id para área de transferência"
      onClick={copyIdToClipboard}
      variant="secondary"
      className="p-2"
    >
      <Copy className="size-4" />
    </Button>
  );
};
