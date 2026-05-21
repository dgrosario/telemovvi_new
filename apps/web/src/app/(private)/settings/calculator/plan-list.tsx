"use client";

import { createPlan, deletePlan, setDefaultPlan, updatePlan } from "@/app/actions/payment-plans";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import { PaymentPlan } from "@omnichannel/core/domain/entities/payment-plan";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { ChevronRight, MoreVertical, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

type Props = {
  plans: PaymentPlan.Raw[];
  onSelectPlan: (planId: string) => void;
};

export function PlanList({ plans, onSelectPlan }: Props) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [copyFromPlanId, setCopyFromPlanId] = useState<string>("");
  const [shouldCopyFromPlan, setShouldCopyFromPlan] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PaymentPlan.Raw | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuPlan, setMenuPlan] = useState<PaymentPlan.Raw | null>(null);

  const createMutation = useServerActionMutation(createPlan, {
    onSuccess() {
      toast.success("Plano criado com sucesso!");
      handleCloseCreateDialog();
      router.refresh();
    },
    onError(error) {
      toast.error(error.message || "Erro ao criar plano");
    },
  });

  const deleteMutation = useServerActionMutation(deletePlan, {
    onSuccess() {
      toast.success("Plano removido com sucesso!");
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      router.refresh();
    },
    onError(error) {
      toast.error(error.message || "Erro ao remover plano");
    },
  });

  const setDefaultMutation = useServerActionMutation(setDefaultPlan, {
    onSuccess() {
      toast.success("Plano padrão definido!");
      router.refresh();
    },
    onError(error) {
      toast.error(error.message || "Erro ao definir plano padrão");
    },
  });

  const toggleEnabledMutation = useServerActionMutation(updatePlan, {
    onSuccess() {
      router.refresh();
    },
    onError(error) {
      toast.error(error.message || "Erro ao atualizar plano");
    },
  });

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewPlanName("");
    setCopyFromPlanId("");
    setShouldCopyFromPlan(false);
  };

  const handleCreatePlan = () => {
    if (!newPlanName.trim()) {
      toast.error("Nome do plano é obrigatório");
      return;
    }
    createMutation.mutate({
      name: newPlanName.trim(),
      copyFromPlanId: shouldCopyFromPlan && copyFromPlanId ? copyFromPlanId : null,
    });
  };

  const handleDeletePlan = () => {
    if (planToDelete) {
      deleteMutation.mutate({ id: planToDelete.id });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, plan: PaymentPlan.Raw) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuPlan(plan);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuPlan(null);
  };

  const handleSetDefault = () => {
    if (menuPlan) {
      setDefaultMutation.mutate({ planId: menuPlan.id });
    }
    handleMenuClose();
  };

  const handleToggleEnabled = () => {
    if (menuPlan) {
      toggleEnabledMutation.mutate({
        id: menuPlan.id,
        isEnabled: !menuPlan.isEnabled,
      });
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (menuPlan) {
      setPlanToDelete(menuPlan);
      setDeleteDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleOpenCreateDialog = () => {
    setNewPlanName("");
    setCopyFromPlanId(plans[0]?.id ?? "");
    setShouldCopyFromPlan(plans.length > 0);
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Planos de Pagamento</h3>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Plus className="size-4" />}
          onClick={handleOpenCreateDialog}
        >
          Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card variant="outlined" className="p-8 text-center">
          <p className="text-gray-500 mb-4">Nenhum plano cadastrado</p>
          <Button
            variant="contained"
            startIcon={<Plus className="size-4" />}
            onClick={handleOpenCreateDialog}
          >
            Criar Primeiro Plano
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              variant="outlined"
              className={`cursor-pointer transition-all hover:border-green-400 hover:shadow-sm ${
                !plan.isEnabled ? "opacity-50" : ""
              }`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.isDefault && (
                        <Chip
                          size="small"
                          label="Padrão"
                          color="primary"
                          icon={<Star className="size-3" />}
                        />
                      )}
                      {!plan.isEnabled && (
                        <Chip size="small" label="Desabilitado" color="default" />
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-500">{plan.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, plan)}>
                    <MoreVertical className="size-4" />
                  </IconButton>
                  <ChevronRight className="size-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Menu de ações */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {menuPlan && !menuPlan.isDefault && (
          <MenuItem onClick={handleSetDefault}>
            <Star className="size-4 mr-2" />
            Definir como Padrão
          </MenuItem>
        )}
        <MenuItem onClick={handleToggleEnabled}>
          {menuPlan?.isEnabled ? "Desabilitar" : "Habilitar"}
        </MenuItem>
        <MenuItem onClick={handleDelete} className="text-red-500">
          <Trash2 className="size-4 mr-2" />
          Excluir
        </MenuItem>
      </Menu>

      {/* Dialog criar plano */}
      <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Plano de Pagamento</DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <TextField
              autoFocus
              label="Nome do Plano"
              placeholder="Ex: Visa/Master, Elo, PIX"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              fullWidth
            />

            {plans.length > 0 && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={shouldCopyFromPlan}
                      onChange={(e) => setShouldCopyFromPlan(e.target.checked)}
                    />
                  }
                  label="Copiar parcelas de um plano existente"
                />

                {shouldCopyFromPlan && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Copiar de</InputLabel>
                    <Select
                      value={copyFromPlanId}
                      onChange={(e) => setCopyFromPlanId(e.target.value)}
                      label="Copiar de"
                    >
                      {plans.map((plan) => (
                        <MenuItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCreatePlan}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Criando..." : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          Deseja realmente excluir o plano "{planToDelete?.name}"? Esta ação não pode ser desfeita.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeletePlan}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
