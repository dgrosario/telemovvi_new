"use client";
import CustomTextField from "@/components/custom-text-field";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { Button, Typography } from "@mui/material";
import Image from "next/image";
import { useState } from "react";
import { toast } from "react-toastify";
import pkg from "../../../package.json";
import { authenticate } from "../actions/users";
import { authenticateInputSchema } from "../actions/users/schema";

export default function SignInPage() {
  const [type, setType] = useState("password");
  const { errors, form, setField, validateAll } = useFormState(
    authenticateInputSchema,
    {
      email: "",
      password: "",
    }
  );
  const authenticateActions = useServerActionMutation(authenticate, {
    onError(error) {
      if (error.message === "NEXT_REDIRECT") return;
      toast.error(
        <div className="flex flex-col">
          <Typography variant="h6">Erro ao autenticar</Typography>
          <Typography variant="body2">{error.message}</Typography>
        </div>
      );
    },
  });
  return (
    <main className="bg-white flex min-h-screen flex-1 items-center justify-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();

          const response = validateAll();
          if (!response.ok) return;

          authenticateActions.mutate(form);
        }}
        className="flex gap-4 md:gap-6 flex-col px-6 py-8 md:px-20 md:pt-20 w-full max-w-[600px] min-h-screen md:min-h-0 justify-center"
      >
        <div className="w-full max-w-[150px] md:max-w-[200px] mx-auto">
          <Image alt="Logo" width={500} height={500} src="/icon.png" />
        </div>
        <Typography variant="h5" className="text-center text-sm md:text-base text-gray-500">
          Insira suas credenciais para acessar sua conta.
        </Typography>
        <CustomTextField
          slotProps={{
            input: { startAdornment: <i className="tabler-mail" /> },
          }}
          error={!!errors.email}
          helperText={errors.email}
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          label="Email"
          name="email"
          required
          variant="outlined"
          fullWidth
        />
        <CustomTextField
          error={!!errors.password}
          helperText={errors.password}
          value={form.password}
          onChange={(e) => setField("password", e.target.value)}
          slotProps={{
            input: {
              startAdornment: <i className="tabler-lock" />,
              endAdornment: (
                <Button
                  variant="outlined"
                  size="small"
                  className="!border-none"
                  data-variant="icon"
                  onClick={() =>
                    setType(type === "password" ? "text" : "password")
                  }
                >
                  {type === "password" ? (
                    <i className="tabler-eye text-slate-800" />
                  ) : (
                    <i className="tabler-eye-off text-slate-800" />
                  )}
                </Button>
              ),
            },
          }}
          label="Senha"
          name="password"
          required
          variant="outlined"
          type={type}
          fullWidth
        />
        <Button
          data-action
          variant="contained"
          loading={authenticateActions.isPending}
          loadingPosition="start"
          type="submit"
        >
          {authenticateActions.isPending ? "Acessando..." : "Acessar"}
        </Button>
        <div className="flex items-center justify-center w-full">
          <span className="text-xs text-muted-foreground">v{pkg.version}</span>
        </div>
      </form>
    </main>
  );
}
