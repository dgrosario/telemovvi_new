"use client";

import {
  getCalculatorMessageForChat,
  listInstallmentsForChat,
  listPlansForChat,
} from "@/app/actions/payment-plans";
import { sendMessage } from "@/app/actions/messages";
import { useServerActionMutation, useServerActionQuery } from "@/hooks/server-action-hooks";
import { PaymentPlan } from "@omnichannel/core/domain/entities/payment-plan";
import { PaymentPlanInstallment } from "@omnichannel/core/domain/entities/payment-plan-installment";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Calculator, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

interface PaymentCalculatorProps {
  open: boolean;
  onClose: () => void;
  conversation?: Conversation.Raw;
}

interface InstallmentOption {
  installments: number;
  monthlyPayment: number;
  totalAmount: number;
  totalInterest: number;
  interestRate: number;
  additionalFee: number;
}

function calculatePriceInstallment(
  principal: number,
  interestRate: number,
  additionalFee: number,
  installments: number
): number {
  // Taxa de juros já é o percentual total para todas as parcelas
  // Fórmula: (valor * taxa + taxa_adicional) / numero_parcelas
  const totalWithInterest = principal * (1 + interestRate / 100);
  const totalAmount = totalWithInterest + additionalFee;
  return totalAmount / installments;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function PaymentCalculator({ open, onClose, conversation }: PaymentCalculatorProps) {
  const [totalValue, setTotalValue] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([]);

  // Fetch plans
  const plansQuery = useServerActionQuery(listPlansForChat, {
    queryKey: ["payment-plans-for-chat"],
    input: undefined,
    enabled: open,
  });

  // Fetch installments for selected plan
  const installmentsQuery = useServerActionQuery(listInstallmentsForChat, {
    queryKey: ["plan-installments-for-chat", selectedPlanId],
    input: { planId: selectedPlanId },
    enabled: open && !!selectedPlanId,
  });

  // Fetch footer message
  const messageQuery = useServerActionQuery(getCalculatorMessageForChat, {
    queryKey: ["calculator-message-for-chat"],
    input: undefined,
    enabled: open,
  });

  const sendMessageAction = useServerActionMutation(sendMessage, {
    onSuccess() {
      toast.success("Simulação enviada com sucesso!");
      handleClose();
    },
    onError(error) {
      toast.error(error.message || "Erro ao enviar simulação");
    },
  });

  // Set default plan when plans are loaded
  useEffect(() => {
    if (plansQuery.data && plansQuery.data.length > 0 && !selectedPlanId) {
      const defaultPlan = plansQuery.data.find((p) => p.isDefault);
      setSelectedPlanId(defaultPlan?.id ?? plansQuery.data[0].id);
    }
  }, [plansQuery.data, selectedPlanId]);

  const principal = useMemo(() => {
    const total = parseCurrencyInput(totalValue);
    const down = parseCurrencyInput(downPayment);
    return Math.max(0, total - down);
  }, [totalValue, downPayment]);

  const installmentOptions = useMemo((): InstallmentOption[] => {
    if (principal <= 0 || !installmentsQuery.data) return [];

    return installmentsQuery.data
      .filter((i) => i.isEnabled)
      .map((installment) => {
        const monthlyPayment = calculatePriceInstallment(
          principal,
          installment.interestRate,
          installment.additionalFee,
          installment.installmentNumber
        );
        const totalAmount = monthlyPayment * installment.installmentNumber;
        const totalInterest = totalAmount - principal;

        return {
          installments: installment.installmentNumber,
          monthlyPayment,
          totalAmount,
          totalInterest,
          interestRate: installment.interestRate,
          additionalFee: installment.additionalFee,
        };
      });
  }, [principal, installmentsQuery.data]);

  const selectedPlan = useMemo(() => {
    return plansQuery.data?.find((p) => p.id === selectedPlanId);
  }, [plansQuery.data, selectedPlanId]);

  const handleSendSimulation = () => {
    if (selectedInstallments.length === 0) {
      toast.error("Selecione pelo menos uma parcela");
      return;
    }
    if (!conversation?.id || !conversation?.channel?.id) {
      toast.error("Conversa inválida");
      return;
    }

    const total = parseCurrencyInput(totalValue);
    const down = parseCurrencyInput(downPayment);

    let text = `*Valor da compra:* ${formatCurrency(total)}\n`;
    if (down > 0) {
      text += `*Valor da entrada:* ${formatCurrency(down)}\n`;
    }
    
    // Sempre adicionar o nome do plano se houver um selecionado
    const planName = selectedPlan?.name || "Plano de Pagamento";
    text += `\n*Parcelamento em ${planName}:*\n`;

    // Filtrar apenas as parcelas selecionadas
    const selectedOptions = installmentOptions.filter((option) =>
      selectedInstallments.includes(option.installments)
    );

    for (const option of selectedOptions) {
      text += `${option.installments}x de ${formatCurrency(option.monthlyPayment)}\n`;
    }

    // Add footer message
    if (messageQuery.data?.footerMessage) {
      text += `\n_${messageQuery.data.footerMessage}_`;
    }

    sendMessageAction.mutate({
      conversationId: conversation.id,
      channelId: conversation.channel.id,
      content: text,
    });
  };

  const handleClose = () => {
    setTotalValue("");
    setDownPayment("");
    setSelectedInstallments([]);
    onClose();
  };

  const isLoading = plansQuery.isPending || (selectedPlanId && installmentsQuery.isPending);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center gap-2 !py-3">
        <Calculator className="size-5 text-green-500" />
        <span className="text-base">Calculadora de Pagamento</span>
      </DialogTitle>
      <DialogContent className="!px-3 !py-2">
        <div className="flex flex-col gap-3 pt-1">
          {/* Seleção do plano */}
          <FormControl fullWidth size="small">
            <InputLabel>Forma de Pagamento</InputLabel>
            <Select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              label="Forma de Pagamento"
              disabled={plansQuery.isPending}
            >
              {plansQuery.data?.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                  {plan.isDefault && " (Padrão)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Valor total"
            value={totalValue}
            onChange={(e) => setTotalValue(e.target.value)}
            fullWidth
            placeholder="0,00"
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              },
            }}
          />

          <TextField
            label="Entrada (opcional)"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            fullWidth
            placeholder="0,00"
            size="small"
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              },
            }}
          />

          {isLoading && (
            <div className="flex items-center justify-center py-3">
              <CircularProgress size={20} />
              <span className="ml-2 text-xs text-gray-500">Carregando...</span>
            </div>
          )}

          {!isLoading && plansQuery.data?.length === 0 && (
            <div className="text-center py-3 text-xs text-gray-500">
              Nenhum plano de pagamento configurado.
              <br />
              Configure em Configurações → Calculadora.
            </div>
          )}

          {principal > 0 && !isLoading && installmentOptions.length > 0 && (
            <>
              <Divider className="!my-1" />
              <Typography variant="body2" className="!text-xs !mb-1 !font-medium">
                Valor a financiar: {formatCurrency(principal)}
              </Typography>
              <Typography variant="body2" color="text.secondary" className="!text-xs !mb-2">
                Limita as parcelas exibidas na simulação
              </Typography>

              <TableContainer component={Paper} variant="outlined" className="!shadow-none">
                <Table size="small" className="[&_td]:!py-1.5 [&_td]:!px-2 [&_th]:!py-1.5 [&_th]:!px-2 [&_td]:!text-xs [&_th]:!text-xs">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="none" className="!w-8"></TableCell>
                      <TableCell className="!font-semibold">Parcelas</TableCell>
                      <TableCell align="right" className="!font-semibold">Valor</TableCell>
                      <TableCell align="right" className="!font-semibold">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {installmentOptions.map((option) => {
                      const isSelected = selectedInstallments.includes(option.installments);
                      return (
                        <TableRow
                          key={option.installments}
                          hover
                          onClick={() => {
                            setSelectedInstallments((prev) =>
                              prev.includes(option.installments)
                                ? prev.filter((i) => i !== option.installments)
                                : [...prev, option.installments].sort((a, b) => a - b)
                            );
                          }}
                          sx={{
                            cursor: "pointer",
                            backgroundColor: isSelected ? "action.selected" : "inherit",
                          }}
                        >
                          <TableCell padding="none" className="!w-8">
                            <Checkbox checked={isSelected} size="small" className="!p-0" />
                          </TableCell>
                          <TableCell>{option.installments}x</TableCell>
                          <TableCell align="right">
                            {formatCurrency(option.monthlyPayment)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(option.totalAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </div>
      </DialogContent>
      <DialogActions className="!px-3 !py-2 !pt-4 !gap-2">
        <Button onClick={handleClose} disabled={sendMessageAction.isPending} size="small">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSendSimulation}
          size="small"
          disabled={
            selectedInstallments.length === 0 ||
            isLoading ||
            sendMessageAction.isPending ||
            !conversation?.id ||
            !conversation?.channel?.id
          }
          startIcon={
            sendMessageAction.isPending ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <Send className="size-3.5" />
            )
          }
        >
          {sendMessageAction.isPending ? "Enviando..." : "Enviar Simulação"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
