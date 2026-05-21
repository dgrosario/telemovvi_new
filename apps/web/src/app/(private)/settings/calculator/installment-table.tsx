"use client";

import {
  createInstallment,
  deleteInstallment,
  listInstallments,
  updateInstallments,
} from "@/app/actions/payment-plans";
import { useServerActionMutation, useServerActionQuery } from "@/hooks/server-action-hooks";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import { CreditCard, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

type Props = {
  planId: string;
  planName: string;
};

interface InstallmentRow {
  installmentNumber: number;
  interestRate: string;
  additionalFee: string;
  isEnabled: boolean;
}

export function InstallmentTable({ planId, planName }: Props) {
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newInstallment, setNewInstallment] = useState("");
  const [newRate, setNewRate] = useState("2,99");
  const [newFee, setNewFee] = useState("0");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [installmentToDelete, setInstallmentToDelete] = useState<number | null>(null);

  const installmentsQuery = useServerActionQuery(listInstallments, {
    queryKey: ["plan-installments", planId],
    input: { planId },
    enabled: !!planId,
  });

  const updateMutation = useServerActionMutation(updateInstallments, {
    onSuccess() {
      toast.success("Configurações salvas!");
      setHasChanges(false);
    },
    onError(error) {
      toast.error(error.message || "Erro ao salvar");
    },
  });

  const createMutation = useServerActionMutation(createInstallment, {
    onSuccess(data) {
      if (data) {
        setRows((prev) =>
          [
            ...prev,
            {
              installmentNumber: data.installmentNumber,
              interestRate: data.interestRate.toString().replace(".", ","),
              additionalFee: data.additionalFee.toString().replace(".", ","),
              isEnabled: data.isEnabled,
            },
          ].sort((a, b) => a.installmentNumber - b.installmentNumber)
        );
        toast.success("Parcela adicionada!");
      }
      setAddDialogOpen(false);
      setNewInstallment("");
      setNewRate("2,99");
      setNewFee("0");
    },
    onError(error) {
      toast.error(error.message || "Erro ao adicionar parcela");
    },
  });

  const deleteMutation = useServerActionMutation(deleteInstallment, {
    onSuccess() {
      if (installmentToDelete !== null) {
        setRows((prev) => prev.filter((r) => r.installmentNumber !== installmentToDelete));
        toast.success("Parcela removida!");
      }
      setDeleteConfirmOpen(false);
      setInstallmentToDelete(null);
    },
    onError(error) {
      toast.error(error.message || "Erro ao remover parcela");
    },
  });

  useEffect(() => {
    if (installmentsQuery.data && installmentsQuery.data.length > 0) {
      const mappedRows = installmentsQuery.data
        .map((i) => ({
          installmentNumber: i.installmentNumber,
          interestRate: i.interestRate.toString().replace(".", ","),
          additionalFee: i.additionalFee.toString().replace(".", ","),
          isEnabled: i.isEnabled,
        }))
        .sort((a, b) => a.installmentNumber - b.installmentNumber);
      setRows(mappedRows);
      setHasChanges(false);
    } else {
      setRows([]);
    }
  }, [installmentsQuery.data]);

  const handleRateChange = useCallback((installmentNumber: number, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.installmentNumber === installmentNumber ? { ...row, interestRate: value } : row
      )
    );
    setHasChanges(true);
  }, []);

  const handleFeeChange = useCallback((installmentNumber: number, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.installmentNumber === installmentNumber ? { ...row, additionalFee: value } : row
      )
    );
    setHasChanges(true);
  }, []);

  const handleEnabledChange = useCallback((installmentNumber: number, enabled: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.installmentNumber === installmentNumber ? { ...row, isEnabled: enabled } : row
      )
    );
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    const installments = rows.map((row) => ({
      installmentNumber: row.installmentNumber,
      interestRate: parseFloat(row.interestRate.replace(",", ".")) || 0,
      additionalFee: parseFloat(row.additionalFee.replace(",", ".")) || 0,
      isEnabled: row.isEnabled,
    }));

    updateMutation.mutate({ planId, installments });
  }, [rows, planId, updateMutation]);

  const handleAddInstallment = useCallback(() => {
    const installmentNum = parseInt(newInstallment, 10);
    if (isNaN(installmentNum) || installmentNum < 1 || installmentNum > 99) {
      toast.error("Número de parcelas deve ser entre 1 e 99");
      return;
    }

    if (rows.some((r) => r.installmentNumber === installmentNum)) {
      toast.error("Esta quantidade de parcelas já existe");
      return;
    }

    const rate = parseFloat(newRate.replace(",", ".")) || 0;
    const fee = parseFloat(newFee.replace(",", ".")) || 0;

    createMutation.mutate({
      planId,
      installmentNumber: installmentNum,
      interestRate: rate,
      additionalFee: fee,
      isEnabled: true,
    });
  }, [newInstallment, newRate, newFee, rows, planId, createMutation]);

  const handleDeleteClick = useCallback((installmentNumber: number) => {
    setInstallmentToDelete(installmentNumber);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (installmentToDelete !== null) {
      deleteMutation.mutate({ planId, installmentNumber: installmentToDelete });
    }
  }, [installmentToDelete, planId, deleteMutation]);

  const getNextSuggestedInstallment = useCallback(() => {
    if (rows.length === 0) return 1;
    const maxInstallment = Math.max(...rows.map((r) => r.installmentNumber));
    return maxInstallment + 1;
  }, [rows]);

  const parseRate = (value: string): number => parseFloat(value.replace(",", ".")) || 0;

  const calculatePayment = (principal: number, rate: number, fee: number, n: number): number => {
    // Taxa de juros já é o percentual total para todas as parcelas
    // Fórmula: (valor * taxa + taxa_adicional) / numero_parcelas
    const totalWithInterest = principal * (1 + rate / 100);
    const totalAmount = totalWithInterest + fee;
    return totalAmount / n;
  };

  const enabledCount = rows.filter((r) => r.isEnabled).length;

  if (installmentsQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <CircularProgress size={24} />
        <span className="ml-2 text-gray-500">Carregando parcelas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <CreditCard className="size-6 text-green-500" />
          <div>
            <h3 className="text-lg font-medium">{planName}</h3>
            <p className="text-sm text-gray-500">
              {rows.length} parcelas configuradas • {enabledCount} habilitadas
            </p>
          </div>
        </div>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Plus className="size-4" />}
          onClick={() => {
            setNewInstallment(getNextSuggestedInstallment().toString());
            setAddDialogOpen(true);
          }}
        >
          Adicionar Parcela
        </Button>
      </div>

      <Alert severity="info" className="text-sm">
        Configure a taxa de juros (%) e o valor adicional fixo (R$) para cada parcela. Parcelas desabilitadas não
        aparecerão na calculadora do chat.
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={80}>Parcelas</TableCell>
              <TableCell width={130}>Taxa Juros (%)</TableCell>
              <TableCell width={130}>Taxa Adicional (R$)</TableCell>
              <TableCell width={90}>Ativo</TableCell>
              <TableCell>Exemplo (R$ 1.000)</TableCell>
              <TableCell width={50} align="center"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" className="py-8">
                  <span className="text-gray-500">Nenhuma parcela configurada</span>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const rate = parseRate(row.interestRate);
                const fee = parseRate(row.additionalFee);
                const examplePayment = calculatePayment(1000, rate, fee, row.installmentNumber);
                const exampleTotal = examplePayment * row.installmentNumber;

                return (
                  <TableRow
                    key={row.installmentNumber}
                    sx={{
                      opacity: row.isEnabled ? 1 : 0.5,
                      backgroundColor: row.isEnabled ? "transparent" : "action.hover",
                    }}
                  >
                    <TableCell>
                      <span className="font-medium">{row.installmentNumber}x</span>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.interestRate}
                        onChange={(e) => handleRateChange(row.installmentNumber, e.target.value)}
                        disabled={!row.isEnabled}
                        slotProps={{
                          input: {
                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                          },
                        }}
                        sx={{ width: 95 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.additionalFee}
                        onChange={(e) => handleFeeChange(row.installmentNumber, e.target.value)}
                        disabled={!row.isEnabled}
                        slotProps={{
                          input: {
                            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                          },
                        }}
                        sx={{ width: 95 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isEnabled}
                        onChange={(e) => handleEnabledChange(row.installmentNumber, e.target.checked)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {row.isEnabled && (
                        <span className="text-sm text-gray-600">
                          {row.installmentNumber}x de{" "}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(examplePayment)}
                          {row.installmentNumber > 1 && (rate > 0 || fee > 0) && (
                            <span className="text-gray-400 ml-1">
                              (Total:{" "}
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(exampleTotal)}
                              )
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Remover">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(row.installmentNumber)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <div className="flex justify-end">
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending || rows.length === 0}
          startIcon={
            updateMutation.isPending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Save className="size-4" />
            )
          }
        >
          {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      {/* Dialog adicionar parcela */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>Adicionar Parcela</DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-4 pt-2">
            <TextField
              label="Quantidade de Parcelas"
              type="number"
              value={newInstallment}
              onChange={(e) => setNewInstallment(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 99 } }}
              fullWidth
            />
            <TextField
              label="Taxa de Juros (% a.m.)"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              slotProps={{
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
              }}
              fullWidth
            />
            <TextField
              label="Taxa Adicional (R$)"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> },
              }}
              fullWidth
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddInstallment} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          Deseja realmente remover a configuração de {installmentToDelete}x parcelas?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Removendo..." : "Remover"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
