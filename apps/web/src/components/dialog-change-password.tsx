"use client";

import { changeOwnPassword } from "@/app/actions/users";
import { changeOwnPasswordInputSchema } from "@/app/actions/users/schema";
import { useFormState } from "@/hooks/use-form-state";
import { Button } from "@mui/material";
import { useServerAction } from "zsa-react";
import { toast } from "react-toastify";
import CustomTextField from "./custom-text-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DialogChangePassword({ open, onOpenChange }: Props) {
  const { form, setField, errors, validateAll, reset } = useFormState(
    changeOwnPasswordInputSchema,
    {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }
  );

  const changePasswordAction = useServerAction(changeOwnPassword, {
    onSuccess: () => {
      toast.success("Senha alterada com sucesso");
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateAll();
    if (!result.ok) return;
    changePasswordAction.execute(form);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Digite sua senha atual e a nova senha para continuar
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <CustomTextField
            label="Senha atual"
            type="password"
            value={form.currentPassword}
            onChange={(e) => setField("currentPassword", e.target.value)}
            error={!!errors.currentPassword}
            helperText={errors.currentPassword}
            required
          />
          <CustomTextField
            label="Nova senha"
            type="password"
            value={form.newPassword}
            onChange={(e) => setField("newPassword", e.target.value)}
            error={!!errors.newPassword}
            helperText={errors.newPassword}
            required
          />
          <CustomTextField
            label="Confirmar nova senha"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setField("confirmPassword", e.target.value)}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            required
          />
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outlined" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="contained"
              disabled={changePasswordAction.isPending}
            >
              {changePasswordAction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
