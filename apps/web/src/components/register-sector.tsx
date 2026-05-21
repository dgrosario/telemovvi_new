"use client";
import { RiCloseLine } from "@remixicon/react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import Immutable from "seamless-immutable";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { toast } from "react-toastify";
import { upsertSector } from "@/app/actions/sectors";
import { Field } from "./field";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  open: boolean;
  setOpen(open: boolean): void;
};

export type SectorPayload = {
  id?: string;
  name: string;
};

export default function RegisterSector(props: Props) {
  const queryClient = useQueryClient();
  const upsertSectorAction = useServerActionMutation(upsertSector, {
    onSuccess() {
      toast.success("Setor registrado com sucesso");
      props.setOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["list-sectors"],
      });
    },
    onError(error) {
      toast.error("Erro ao registrar setor");
    },
  });
  const [sector, setSector] = useState<SectorPayload>({ name: "" });
  const immutableSector = Immutable(sector);
  return (
    <Dialog open={props.open} onOpenChange={props.setOpen}>
      <DialogContent>
        <DialogClose asChild>
          <Button
            className="absolute right-3 top-3 p-2 !text-gray-400 hover:text-gray-500"
            variant="ghost"
          >
            <RiCloseLine className="size-5 shrink-0" />
          </Button>
        </DialogClose>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            upsertSectorAction.mutate({
              id: sector.id,
              name: sector.name,
            });
          }}
          method="POST"
        >
          <DialogHeader>
            <DialogTitle className="text-base">Cadastro de setores</DialogTitle>
            <DialogDescription className="mt-1 text-sm/6">
              Crie um setor para separar os atendimentos e gerencie facilmente
              suas solicitações
            </DialogDescription>
          </DialogHeader>
          <Field className="mt-6">
            <Label htmlFor="name">Nome do setor</Label>
            <Input
              type="name"
              className="mt-2"
              value={sector.name}
              onChange={(e) => {
                setSector(
                  immutableSector
                    .set("name", e.target.value)
                    .asMutable({ deep: true })
                );
              }}
            />
          </Field>
          <DialogFooter className="mt-6">
            <Button type="submit" className="w-full sm:w-fit">
              Criar
            </Button>
            <DialogClose asChild>
              <Button className="mt-2 w-full sm:mt-0 sm:w-fit" variant="light">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
