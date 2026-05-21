"use client";

import { resetPassword } from "@/app/actions/users";
import { resetPasswordInputSchema } from "@/app/actions/users/schema";
import CustomTextField from "@/components/custom-text-field";
import { useFormState } from "@/hooks/use-form-state";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useServerAction } from "zsa-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
};

export function DialogResetPassword({ open, onOpenChange, userId }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const { form, setField, errors, validateAll, reset } = useFormState(
    resetPasswordInputSchema,
    {
      userId: "",
      newPassword: "",
    }
  );

  useEffect(() => {
    if (userId) {
      setField("userId", userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) {
      reset();
      setConfirmPassword("");
      setConfirmPasswordError("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  const resetPasswordAction = useServerAction(resetPassword, {
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso");
      reset();
      setConfirmPassword("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword !== confirmPassword) {
      setConfirmPasswordError("Senhas não conferem");
      return;
    }
    setConfirmPasswordError("");

    const result = validateAll();
    if (!result.ok) return;

    resetPasswordAction.execute({
      userId,
      newPassword: form.newPassword,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Redefinir Senha</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText className="mb-4">
            Digite a nova senha para o usuário
          </DialogContentText>
          <div className="flex flex-col gap-4">
            <CustomTextField
              label="Nova senha"
              type={showPassword ? "text" : "password"}
              value={form.newPassword}
              onChange={(e) => setField("newPassword", e.target.value)}
              error={!!errors.newPassword}
              helperText={errors.newPassword}
              required
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <CustomTextField
              label="Confirmar nova senha"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!confirmPasswordError}
              helperText={confirmPasswordError}
              required
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        edge="end"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button variant="outlined" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={resetPasswordAction.isPending}
          >
            {resetPasswordAction.isPending ? "Redefinindo..." : "Redefinir"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
