"use client";

import { retrieveUser, upsertUser } from "@/app/actions/users";
import { addSectorsToUser, listSectors } from "@/app/actions/sectors";
import { upsertUserInputSchema } from "@/app/actions/users/schema";
import CustomTextField from "@/components/custom-text-field";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useFormState } from "@/hooks/use-form-state";
import { useUsers } from "@/hooks/use-users";
import {
  Autocomplete,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  SwipeableDrawer,
  TextField,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { DialogResetPassword } from "./dialog-reset-password";

type SectorOption = {
  id: string;
  name: string;
};

export function ModalRegisterUser() {
  const { toggleOpen, open, userId, setUserId } = useUsers();
  const [showPassword, setShowPassword] = useState(true);
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [selectedSectors, setSelectedSectors] = useState<SectorOption[]>([]);

  const { form, validateAll, setField, errors, reset, setForm } = useFormState(
    upsertUserInputSchema,
    {
      email: "",
      name: "",
      password: "102030",
      displayName: "",
      phone: "",
      birthDate: "",
      address: "",
    }
  );

  const queryClient = useQueryClient();

  const sectorsQuery = useServerActionQuery(listSectors, {
    input: undefined,
    queryKey: ["list-sectors-for-user-registration"],
  });

  const retrieveUserAction = useServerActionQuery(retrieveUser, {
    input: { id: userId },
    queryKey: ["retrieve-user"],
    enabled: !!userId,
  });

  const addSectorAction = useServerActionMutation(addSectorsToUser);

  const upsertUserAction = useServerActionMutation(upsertUser, {
    async onSuccess(data) {
      if (data && data.isNewUser && selectedSectors.length > 0) {
        for (const sector of selectedSectors) {
          await addSectorAction.mutateAsync({
            userId: data.userId,
            sectorId: sector.id,
          });
        }
      }

      await queryClient.invalidateQueries({
        exact: true,
        queryKey: ["list-users"],
      });
      toggleOpen();
      toast.success(
        form.id ? "Usuário alterado com sucesso" : "Usuário criado com sucesso"
      );
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setShowPassword(true);
      setSelectedSectors([]);
      setUserId("");
    }
  }, [open]);

  useEffect(() => {
    retrieveUserAction.refetch();
  }, [userId]);

  useEffect(() => {
    if (retrieveUserAction.data) {
      setForm(retrieveUserAction.data);
      if (retrieveUserAction.data.sectors) {
        setSelectedSectors(retrieveUserAction.data.sectors);
      }
    }
  }, [retrieveUserAction.data]);

  const sectors = sectorsQuery.data ?? [];

  return (
    <>
      <SwipeableDrawer
        onOpen={toggleOpen}
        anchor="right"
        open={open}
        onClose={toggleOpen}
      >
        <div className="mx-auto min-w-[500px] w-full p-5">
          <Typography variant="h5" className="font-semibold">
            {form.id ? "Editar usuario" : "Cadastrar usuario"}
          </Typography>
          <Typography variant="subtitle2">
            Preencha as informacoes para continuar
          </Typography>
          <Divider className="!mb-4 !mt-2" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const result = validateAll();
              if (!result.ok) return;
              upsertUserAction.mutate(form);
            }}
            className="flex flex-col gap-6"
          >
            <CustomTextField
              label="Nome"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
            <CustomTextField
              label="Email"
              type="email"
              value={form.email}
              error={!!errors.email}
              helperText={errors.email}
              required
              onChange={(e) => setField("email", e.target.value)}
            />
            <CustomTextField
              label="Nome de exibição"
              value={form.displayName || ""}
              onChange={(e) => setField("displayName", e.target.value || null)}
              helperText="Nome que será exibido nas conversas (opcional)"
            />
            <CustomTextField
              label="Telefone"
              value={form.phone || ""}
              onChange={(e) => setField("phone", e.target.value || null)}
              placeholder="(00) 00000-0000"
            />
            <CustomTextField
              label="Data de nascimento"
              type="date"
              value={form.birthDate || ""}
              onChange={(e) => setField("birthDate", e.target.value || null)}
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <CustomTextField
              label="Endereço"
              value={form.address || ""}
              onChange={(e) => setField("address", e.target.value || null)}
              placeholder="Rua, número, bairro, cidade"
            />
            {!form.id && (
              <>
                <CustomTextField
                  label="Senha inicial"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  error={!!errors.password}
                  helperText={errors.password || "Senha padrão: 102030"}
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
                <Autocomplete
                  multiple
                  options={sectors}
                  getOptionLabel={(option) => option.name}
                  value={selectedSectors}
                  onChange={(_, newValue) => setSelectedSectors(newValue)}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Setores"
                      placeholder="Selecione os setores"
                      helperText="Vincule o usuario a um ou mais setores"
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          label={option.name}
                          size="small"
                          {...tagProps}
                        />
                      );
                    })
                  }
                />
              </>
            )}
            {form.id && (
              <>
                <Divider />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setOpenResetDialog(true)}
                >
                  Redefinir Senha
                </Button>
              </>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              className="w-full sm:w-fit"
              disabled={upsertUserAction.isPending || addSectorAction.isPending}
            >
              {upsertUserAction.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </div>
      </SwipeableDrawer>
      <DialogResetPassword
        open={openResetDialog}
        onOpenChange={setOpenResetDialog}
        userId={form.id || ""}
      />
    </>
  );
}
