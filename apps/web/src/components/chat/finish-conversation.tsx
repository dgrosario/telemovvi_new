"use client";
import { closeConversation } from "@/app/actions/conversations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useConversationStore } from "@/hooks/use-conversation-store";
import { MessageCircleOff } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { Tooltip } from "@mui/material";
import { Button } from "../ui/button";

interface Props {
  conversationId?: string;
}

export const CloseConversation: React.FC<Props> = ({
  conversationId,
}) => {
  const [open, setOpen] = useState(false);

  const { mutate: closeConv, isPending } = useServerActionMutation(
    closeConversation,
    {
      onSuccess: (result) => {
        setOpen(false);
        toast.success("Atendimento finalizado com sucesso!", {
          autoClose: 3000,
        });

        if (result && result.conversation) {
          const conversationStore = useConversationStore.getState();
          conversationStore.updateConversation(result.conversation.id, result.conversation);
        }
      },
      onError: (err) => {
        toast.error((err as Error).message || "Erro ao finalizar");
      },
    }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip title="Finalizar atendimento" placement="top">
        <span>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="data-[active=true]:bg-sky-500 group rounded-lg"
              aria-label="Finalizar atendimento"
            >
              <MessageCircleOff className="size-4 group-data-[active=true]:!stroke-sky-100" />
            </Button>
          </DialogTrigger>
        </span>
      </Tooltip>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle className="border-b px-6 py-4 text-lg font-semibold">
            Finalizar atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Tem certeza de que deseja{" "}
            <span className="font-semibold text-foreground">
              finalizar este atendimento
            </span>
            ? Esta ação não poderá ser desfeita.
          </p>

          <form
            className="flex justify-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              closeConv({
                conversationId: conversationId || "",
              });
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="min-w-[100px]"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isPending}
              variant="destructive"
              className="min-w-[120px]"
            >
              {isPending ? "Finalizando..." : "Finalizar"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
