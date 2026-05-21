import type { Node } from "reactflow";

export type VariableType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "day_of_week"
  | "time"
  | "date";

export interface FlowVariable {
  value: string;
  label: string;
  type: VariableType;
  description?: string;
}

export interface VariableCategory {
  id: string;
  label: string;
  icon: string;
  variables: FlowVariable[];
}

export interface Operator {
  value: string;
  label: string;
  icon: string;
  requiresValue: boolean;
  valueCount?: number;
}

export const SYSTEM_CONTEXT_VARIABLES: FlowVariable[] = [
  {
    value: "system.day_of_week",
    label: "Dia da Semana",
    type: "day_of_week",
    description: "Dia da semana atual (avaliado em tempo real)",
  },
  {
    value: "system.current_time",
    label: "Horário Atual",
    type: "time",
    description: "Horário atual no formato HH:mm (avaliado em tempo real)",
  },
  {
    value: "system.current_date",
    label: "Data Atual",
    type: "date",
    description: "Data atual no formato DD/MM/AAAA (avaliado em tempo real)",
  },
];

export const CONTEXT_VARIABLES: FlowVariable[] = [
  {
    value: "user.message",
    label: "Mensagem do Usuário",
    type: "string",
    description: "Última mensagem enviada pelo usuário",
  },
  {
    value: "user.phone",
    label: "Telefone do Usuário",
    type: "string",
    description: "Número de telefone do usuário",
  },
  {
    value: "conversation.channel",
    label: "Canal da Conversa",
    type: "string",
    description: "Canal de origem da conversa (whatsapp, instagram, etc.)",
  },
  {
    value: "conversation.sector",
    label: "Setor da Conversa",
    type: "string",
    description: "Setor atribuído à conversa",
  },
];

export const CONTACT_VARIABLES: FlowVariable[] = [
  {
    value: "partner.name",
    label: "Nome do Contato",
    type: "string",
    description: "Nome do contato/cliente",
  },
  {
    value: "partner.email",
    label: "Email do Contato",
    type: "string",
    description: "Email do contato/cliente",
  },
  {
    value: "partner.labels",
    label: "Etiquetas do Contato",
    type: "array",
    description: "Lista de etiquetas associadas ao contato",
  },
];

export const STRING_OPERATORS: Operator[] = [
  { value: "equals", label: "É igual a", icon: "=", requiresValue: true },
  { value: "not_equals", label: "É diferente de", icon: "!=", requiresValue: true },
  { value: "contains", label: "Contém", icon: "~", requiresValue: true },
  { value: "not_contains", label: "Não contém", icon: "!~", requiresValue: true },
  { value: "starts_with", label: "Começa com", icon: "^", requiresValue: true },
  { value: "ends_with", label: "Termina com", icon: "$", requiresValue: true },
  { value: "is_empty", label: "Está vazio", icon: "0", requiresValue: false },
  { value: "is_not_empty", label: "Não está vazio", icon: "!0", requiresValue: false },
];

export const NUMBER_OPERATORS: Operator[] = [
  { value: "equals", label: "É igual a", icon: "=", requiresValue: true },
  { value: "not_equals", label: "É diferente de", icon: "!=", requiresValue: true },
  { value: "greater_than", label: "É maior que", icon: ">", requiresValue: true },
  { value: "less_than", label: "É menor que", icon: "<", requiresValue: true },
  { value: "greater_or_equal", label: "É maior ou igual a", icon: ">=", requiresValue: true },
  { value: "less_or_equal", label: "É menor ou igual a", icon: "<=", requiresValue: true },
  { value: "between", label: "Está entre", icon: "<>", requiresValue: true, valueCount: 2 },
];

export const BOOLEAN_OPERATORS: Operator[] = [
  { value: "is_true", label: "É verdadeiro", icon: "V", requiresValue: false },
  { value: "is_false", label: "É falso", icon: "X", requiresValue: false },
];

export const ARRAY_OPERATORS: Operator[] = [
  { value: "contains", label: "Contém item", icon: "E", requiresValue: true },
  { value: "not_contains", label: "Não contém item", icon: "!E", requiresValue: true },
  { value: "is_empty", label: "Está vazio", icon: "0", requiresValue: false },
  { value: "is_not_empty", label: "Não está vazio", icon: "!0", requiresValue: false },
];

export const DAY_OF_WEEK_OPERATORS: Operator[] = [
  { value: "in_days", label: "Inclui os dias", icon: "D", requiresValue: true },
  { value: "not_in_days", label: "Não inclui os dias", icon: "!D", requiresValue: true },
];

export const TIME_OPERATORS: Operator[] = [
  { value: "equals", label: "É igual a", icon: "=", requiresValue: true },
  { value: "not_equals", label: "É diferente de", icon: "!=", requiresValue: true },
  { value: "greater_than", label: "É depois de", icon: ">", requiresValue: true },
  { value: "less_than", label: "É antes de", icon: "<", requiresValue: true },
  { value: "greater_or_equal", label: "É a partir de", icon: ">=", requiresValue: true },
  { value: "less_or_equal", label: "É até", icon: "<=", requiresValue: true },
  { value: "between", label: "Está entre", icon: "<>", requiresValue: true, valueCount: 2 },
];

export const DATE_OPERATORS: Operator[] = [
  { value: "equals", label: "É igual a", icon: "=", requiresValue: true },
  { value: "not_equals", label: "É diferente de", icon: "!=", requiresValue: true },
  { value: "greater_than", label: "É depois de", icon: ">", requiresValue: true },
  { value: "less_than", label: "É antes de", icon: "<", requiresValue: true },
  { value: "greater_or_equal", label: "É a partir de", icon: ">=", requiresValue: true },
  { value: "less_or_equal", label: "É até", icon: "<=", requiresValue: true },
  { value: "between", label: "Está entre", icon: "<>", requiresValue: true, valueCount: 2 },
  { value: "is_empty", label: "Está vazio", icon: "0", requiresValue: false },
  { value: "is_not_empty", label: "Não está vazio", icon: "!0", requiresValue: false },
];

export const OPERATORS_BY_TYPE: Record<VariableType, Operator[]> = {
  string: STRING_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  array: ARRAY_OPERATORS,
  day_of_week: DAY_OF_WEEK_OPERATORS,
  time: TIME_OPERATORS,
  date: DATE_OPERATORS,
};

export function getOperatorsForType(type: VariableType): Operator[] {
  return OPERATORS_BY_TYPE[type] || STRING_OPERATORS;
}

export function getOperatorByValue(value: string, type: VariableType): Operator | undefined {
  const operators = getOperatorsForType(type);
  return operators.find((op) => op.value === value);
}

export interface SystemVariableInput {
  key: string;
  label: string;
  description?: string | null;
  resolverType?:
    | "contact_field"
    | "attendant_field"
    | "time_based"
    | "current_time"
    | "current_date"
    | "day_of_week"
    | "conversation_field"
    | "custom";
}

function mapResolverTypeToVariableType(
  resolverType: SystemVariableInput["resolverType"]
): VariableType {
  if (resolverType === "current_date") return "date";
  if (resolverType === "current_time") return "time";
  if (resolverType === "day_of_week") return "day_of_week";
  return "string";
}

export function getVariableCategories(
  flowVariables: FlowVariable[] = [],
  systemVariables: SystemVariableInput[] = []
): VariableCategory[] {
  const categories: VariableCategory[] = [];

  // Variaveis de sistema do banco (saudacao, horario, data, etc.)
  if (systemVariables.length > 0) {
    categories.push({
      id: "system",
      label: "Variaveis de Sistema",
      icon: "Settings",
      variables: systemVariables.map((v) => ({
        value: v.key,
        label: v.label,
        type: mapResolverTypeToVariableType(v.resolverType),
        description: v.description ?? undefined,
      })),
    });
  }

  categories.push({
    id: "system_context",
    label: "Contexto do Sistema",
    icon: "Schedule",
    variables: SYSTEM_CONTEXT_VARIABLES,
  });

  categories.push(
    {
      id: "context",
      label: "Contexto da Conversa",
      icon: "ChatBubbleOutline",
      variables: CONTEXT_VARIABLES,
    },
    {
      id: "contact",
      label: "Dados do Contato",
      icon: "PersonOutline",
      variables: CONTACT_VARIABLES,
    }
  );

  if (flowVariables.length > 0) {
    categories.push({
      id: "flow",
      label: "Variaveis do Fluxo",
      icon: "AccountTree",
      variables: flowVariables,
    });
  }

  return categories;
}

export function getAllVariables(flowVariables: FlowVariable[] = []): FlowVariable[] {
  return [...SYSTEM_CONTEXT_VARIABLES, ...CONTEXT_VARIABLES, ...CONTACT_VARIABLES, ...flowVariables];
}

export function getVariableByValue(value: string, flowVariables: FlowVariable[] = []): FlowVariable | undefined {
  return getAllVariables(flowVariables).find((v) => v.value === value);
}

export function extractFlowVariables(nodes: Node[]): FlowVariable[] {
  const variables: FlowVariable[] = [];
  const seenVariables = new Set<string>();

  for (const node of nodes) {
    if (node.type === "action" && node.data) {
      const { actionType, variableName, inputValidationType } = node.data as {
        actionType?: string;
        variableName?: string;
        inputValidationType?: string;
      };

      if (actionType === "set_variable" && variableName && !seenVariables.has(variableName)) {
        seenVariables.add(variableName);
        variables.push({
          value: `flow.${variableName}`,
          label: variableName,
          type: "string",
          description: `Variável definida pelo bloco "${node.data.label || "Ação"}"`,
        });
      }

      if (actionType === "capture_input" && variableName && !seenVariables.has(variableName)) {
        seenVariables.add(variableName);
        const varType: VariableType =
          inputValidationType === "number"
            ? "number"
            : inputValidationType === "date"
              ? "date"
              : inputValidationType === "time"
                ? "time"
                : "string";
        variables.push({
          value: `flow.${variableName}`,
          label: variableName,
          type: varType,
          description: `Entrada capturada pelo bloco "${node.data.label || "Ação"}"`,
        });
      }
    }

    if (node.type === "input" && node.data) {
      const { variableName, validationType } = node.data as {
        variableName?: string;
        validationType?: string;
      };

      if (variableName && !seenVariables.has(variableName)) {
        seenVariables.add(variableName);
        const varType: VariableType =
          validationType === "number"
            ? "number"
            : validationType === "date"
              ? "date"
              : validationType === "time"
                ? "time"
                : "string";
        variables.push({
          value: `flow.${variableName}`,
          label: variableName,
          type: varType,
          description: `Entrada coletada pelo bloco "${node.data.label || "Entrada"}"`,
        });
      }
    }
  }

  return variables;
}

export function formatOperatorLabel(operator: Operator): string {
  return `${operator.icon} ${operator.label}`;
}

export function formatVariableLabel(variable: FlowVariable, showType = false): string {
  if (showType) {
    return `${variable.label} (${variable.type})`;
  }
  return variable.label;
}
