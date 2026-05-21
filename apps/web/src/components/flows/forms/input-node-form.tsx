"use client";

import { useRef } from "react";
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Stack,
  Divider,
  Typography,
  FormControlLabel,
  Checkbox,
  Box,
} from "@mui/material";
import { useFormState } from "@/hooks/use-form-state";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { FlowVariableInserter } from "./flow-variable-inserter";
import { extractFlowVariables } from "@/lib/flow-variables";
import { z } from "zod";

const contactFields = [
  "name",
  "email",
  "phone",
  "document",
  "address",
  "city",
  "state",
  "zipCode",
] as const;
type ContactField = (typeof contactFields)[number];

const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  document: "Documento (CPF/CNPJ)",
  address: "Endereço",
  city: "Cidade",
  state: "Estado",
  zipCode: "CEP",
};

const inputValidationTypes = [
  "text",
  "number",
  "email",
  "phone",
  "cpf",
  "cnpj",
  "cep",
  "date",
  "time",
  "options",
] as const;
type InputValidationType = (typeof inputValidationTypes)[number];

const INPUT_VALIDATION_TYPE_LABELS: Record<InputValidationType, string> = {
  text: "Texto livre",
  number: "Número",
  email: "E-mail",
  phone: "Telefone",
  cpf: "CPF",
  cnpj: "CNPJ",
  cep: "CEP",
  date: "Data (DD/MM/AAAA)",
  time: "Horário (HH:MM)",
  options: "Lista de opções",
};

const inputNodeSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Pergunta é obrigatória")
    .max(1000, "Pergunta deve ter no máximo 1000 caracteres"),
  variableName: z
    .string()
    .trim()
    .min(1, "Nome da variável é obrigatório")
    .max(100, "Nome da variável deve ter no máximo 100 caracteres")
    .regex(
      /^[a-z_][a-z0-9_]*$/,
      "Use apenas letras minúsculas, números e underscore, iniciando por letra ou underscore"
    ),
  validationType: z.enum(inputValidationTypes).default("text"),
  inputOptions: z
    .array(z.string().trim().min(1).max(200))
    .max(50, "Máximo de 50 opções")
    .optional()
    .default([]),
  errorMessage: z
    .string()
    .trim()
    .max(500, "Mensagem de erro deve ter no máximo 500 caracteres")
    .optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  saveToContact: z.boolean(),
  contactField: z.enum(contactFields).optional(),
});

function isContactField(value: string): value is ContactField {
  return contactFields.includes(value as ContactField);
}

function isInputValidationType(value: string): value is InputValidationType {
  return inputValidationTypes.includes(value as InputValidationType);
}

interface InputNodeFormProps {
  nodeId: string;
  initialData?: {
    label?: string;
    question?: string;
    variableName?: string;
    validationType?: string;
    inputOptions?: string[];
    errorMessage?: string;
    maxAttempts?: number;
    saveToContact?: boolean;
    contactField?: string;
  };
  onClose: () => void;
}

export function InputNodeForm({ nodeId, initialData, onClose }: InputNodeFormProps) {
  const updateNodeData = useFlowEditorStore((s) => s.updateNodeData);
  const nodes = useFlowEditorStore((s) => s.nodes);
  const flowVariables = extractFlowVariables(nodes);

  const questionRef = useRef<HTMLInputElement>(null);

  const initialContactField: ContactField | undefined =
    initialData?.contactField && isContactField(initialData.contactField)
      ? initialData.contactField
      : undefined;
  const initialValidationType: InputValidationType =
    initialData?.validationType && isInputValidationType(initialData.validationType)
      ? initialData.validationType
      : "text";

  const { form, setField, errors, validateAll } = useFormState(inputNodeSchema, {
    question: initialData?.question || "",
    variableName: initialData?.variableName || "",
    validationType: initialValidationType,
    inputOptions: initialData?.inputOptions || [],
    errorMessage: initialData?.errorMessage || "",
    maxAttempts: Math.min(10, Math.max(1, initialData?.maxAttempts || 3)),
    saveToContact: initialData?.saveToContact || false,
    contactField: initialContactField,
  });

  const handleSave = () => {
    const validation = validateAll();
    if (validation.ok && validation.value) {
      updateNodeData(nodeId, {
        question: validation.value.question,
        variableName: validation.value.variableName,
        validationType: validation.value.validationType,
        inputOptions: validation.value.validationType === "options"
          ? validation.value.inputOptions
          : [],
        errorMessage: validation.value.errorMessage,
        maxAttempts: validation.value.maxAttempts,
        saveToContact: validation.value.saveToContact,
        contactField: validation.value.contactField,
      });
      onClose();
    }
  };

  const handleInsertVariable = (variable: string) => {
    if (questionRef.current) {
      const start = questionRef.current.selectionStart || 0;
      const end = questionRef.current.selectionEnd || 0;
      const currentValue = form.question;
      const newValue =
        currentValue.substring(0, start) + variable + currentValue.substring(end);
      setField("question", newValue);
    } else {
      setField("question", form.question + variable);
    }
  };

  return (
    <Stack spacing={3} onClick={(e) => e.stopPropagation()}>
      <Typography variant="subtitle2" color="text.secondary">
        Configure a pergunta que será feita ao usuário
      </Typography>

      <Box sx={{ position: "relative" }}>
        <TextField
          inputRef={questionRef}
          label="Pergunta"
          fullWidth
          multiline
          rows={3}
          value={form.question}
          onChange={(e) => setField("question", e.target.value)}
          error={Boolean(errors.question)}
          helperText={errors.question || "Use variáveis como {{nome_contato}}"}
          placeholder="Ex: Qual é seu nome completo?"
        />
        <Box sx={{ position: "absolute", right: 8, top: 8 }}>
          <FlowVariableInserter
            flowVariables={flowVariables}
            onInsert={handleInsertVariable}
          />
        </Box>
      </Box>

      <TextField
        label="Nome da Variável"
        fullWidth
        value={form.variableName}
        onChange={(e) =>
          setField("variableName", e.target.value.replace(/\s/g, "_").toLowerCase())
        }
        error={Boolean(errors.variableName)}
        helperText={
          errors.variableName ||
          "Será acessível como {{flow." + (form.variableName || "nome_variavel") + "}}"
        }
        placeholder="Ex: nome_cliente"
      />

      <FormControl fullWidth>
        <InputLabel>Tipo de Validação</InputLabel>
        <Select
          value={form.validationType}
          onChange={(e) => {
            if (isInputValidationType(e.target.value)) {
              setField("validationType", e.target.value);
              if (e.target.value !== "options") {
                setField("inputOptions", []);
              }
            }
          }}
          label="Tipo de Validação"
        >
          {inputValidationTypes.map((type) => (
            <MenuItem key={type} value={type}>
              {INPUT_VALIDATION_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {form.validationType === "options" && (
        <TextField
          label="Opções (uma por linha)"
          fullWidth
          multiline
          minRows={3}
          value={(form.inputOptions || []).join("\n")}
          onChange={(e) => {
            const options = e.target.value
              .split("\n")
              .map((option) => option.trim())
              .filter(Boolean);
            setField("inputOptions", options);
          }}
          helperText="O cliente pode responder com o texto da opção ou com o número da opção"
        />
      )}

      <TextField
        label="Mensagem de Erro (opcional)"
        fullWidth
        value={form.errorMessage || ""}
        onChange={(e) => setField("errorMessage", e.target.value)}
        placeholder="Ex: Resposta inválida, tente novamente"
      />

      <TextField
        label="Tentativas Máximas"
        type="number"
        fullWidth
        value={form.maxAttempts}
        onChange={(e) =>
          setField(
            "maxAttempts",
            Math.min(10, Math.max(1, Number.parseInt(e.target.value, 10) || 1))
          )
        }
        slotProps={{ htmlInput: { min: 1, max: 10 } }}
      />

      <Divider />

      <FormControlLabel
        control={
          <Checkbox
            checked={form.saveToContact}
            onChange={(e) => setField("saveToContact", e.target.checked)}
          />
        }
        label="Salvar no perfil do contato"
      />

      {form.saveToContact && (
        <FormControl fullWidth>
          <InputLabel>Salvar em</InputLabel>
          <Select
            value={form.contactField || ""}
            onChange={(e) => {
              if (isContactField(e.target.value)) {
                setField("contactField", e.target.value);
              }
            }}
            label="Salvar em"
          >
            {contactFields.map((field) => (
              <MenuItem key={field} value={field}>
                {CONTACT_FIELD_LABELS[field]}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            O valor será salvo permanentemente no perfil do contato
          </FormHelperText>
        </FormControl>
      )}

      <Button onClick={handleSave} variant="contained" fullWidth>
        Salvar
      </Button>
    </Stack>
  );
}
