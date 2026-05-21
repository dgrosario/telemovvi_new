"use client";

import { getCalculatorMessage, updateCalculatorMessage } from "@/app/actions/payment-plans";
import { useServerActionMutation, useServerActionQuery } from "@/hooks/server-action-hooks";
import { Button, CircularProgress, TextField } from "@mui/material";
import { MessageSquare, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export function MessageSettings() {
  const [footerMessage, setFooterMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const messageQuery = useServerActionQuery(getCalculatorMessage, {
    queryKey: ["calculator-message"],
    input: undefined,
  });

  const updateMutation = useServerActionMutation(updateCalculatorMessage, {
    onSuccess() {
      toast.success("Mensagem salva!");
      setHasChanges(false);
    },
    onError(error) {
      toast.error(error.message || "Erro ao salvar mensagem");
    },
  });

  useEffect(() => {
    if (messageQuery.data) {
      setFooterMessage(messageQuery.data.footerMessage);
      setHasChanges(false);
    }
  }, [messageQuery.data]);

  const handleSave = () => {
    updateMutation.mutate({ footerMessage });
  };

  if (messageQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-4">
        <CircularProgress size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-green-500" />
        <h3 className="text-lg font-medium">Mensagem do Rodapé</h3>
      </div>
      
      <p className="text-sm text-gray-500">
        Esta mensagem será exibida no final de cada simulação enviada ao cliente.
      </p>

      <TextField
        multiline
        rows={2}
        value={footerMessage}
        onChange={(e) => {
          setFooterMessage(e.target.value);
          setHasChanges(true);
        }}
        placeholder="Ex: Valores sujeitos a alteração. Consulte condições."
        fullWidth
        variant="outlined"
        size="small"
      />

      <div className="flex justify-end">
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          startIcon={
            updateMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Save className="size-4" />
            )
          }
        >
          {updateMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
