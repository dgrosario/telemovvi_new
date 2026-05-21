import type { Node } from "reactflow";
import type { NodeExecutor, ExecutionContext, ExecutionResult } from "../types";

interface Rule {
  id: string;
  variable: string;
  variableType?: "string" | "number" | "boolean" | "array" | "day_of_week" | "time" | "date";
  operator: string;
  value: string;
  value2?: string;
}

interface Condition {
  id: string;
  label: string;
  rules: Rule[];
}

interface LegacyCondition {
  id: string;
  variable: string;
  variableType?: "string" | "number" | "boolean" | "array" | "day_of_week" | "time" | "date";
  operator: string;
  value: string;
  value2?: string;
  label?: string;
}

type ConditionInput = Condition | LegacyCondition;

function isLegacyCondition(condition: ConditionInput): condition is LegacyCondition {
  return "variable" in condition && !("rules" in condition);
}

function normalizeCondition(condition: ConditionInput): Condition {
  if (isLegacyCondition(condition)) {
    return {
      id: condition.id,
      label: condition.label || "Condição",
      rules: [{
        id: crypto.randomUUID(),
        variable: condition.variable,
        variableType: condition.variableType,
        operator: condition.operator,
        value: condition.value,
        value2: condition.value2,
      }],
    };
  }
  return condition;
}

function timeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDateToTimestamp(dateStr: string): number | null {
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch?.[1] && brMatch[2] && brMatch[3]) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    const year = parseInt(brMatch[3], 10);
    const date = new Date(year, month - 1, day);
    if (
      date.getDate() !== day ||
      date.getMonth() !== month - 1 ||
      date.getFullYear() !== year
    ) {
      return null;
    }
    return date.getTime();
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const date = new Date(year, month - 1, day);
    if (
      date.getDate() !== day ||
      date.getMonth() !== month - 1 ||
      date.getFullYear() !== year
    ) {
      return null;
    }
    return date.getTime();
  }

  return null;
}

function evaluateRule(
  varValue: string | number | boolean | string[] | undefined,
  operator: string,
  compareValue: string,
  compareValue2?: string,
  variableType?: string
): boolean {
  if (varValue === undefined) {
    if (operator === "is_empty") return true;
    if (operator === "is_not_empty") return false;
    return false;
  }

  if (operator === "is_empty") {
    if (Array.isArray(varValue)) return varValue.length === 0;
    return String(varValue).trim() === "";
  }

  if (operator === "is_not_empty") {
    if (Array.isArray(varValue)) return varValue.length > 0;
    return String(varValue).trim() !== "";
  }

  if (operator === "is_true") {
    return varValue === true || varValue === "true" || varValue === "1";
  }

  if (operator === "is_false") {
    return varValue === false || varValue === "false" || varValue === "0";
  }

  if (operator === "in_days") {
    const selectedDays = compareValue.split(",").map(d => d.trim());
    return selectedDays.includes(String(varValue));
  }

  if (operator === "not_in_days") {
    const selectedDays = compareValue.split(",").map(d => d.trim());
    return !selectedDays.includes(String(varValue));
  }

  const parsedVariableDate = parseDateToTimestamp(String(varValue));
  const parsedCompareDate = parseDateToTimestamp(compareValue);
  const parsedCompareDate2 = compareValue2
    ? parseDateToTimestamp(compareValue2)
    : null;
  const isDateRule =
    variableType === "date" ||
    (parsedVariableDate !== null && parsedCompareDate !== null);

  if (isDateRule) {
    if (parsedVariableDate === null || parsedCompareDate === null) return false;

    switch (operator) {
      case "equals":
        return parsedVariableDate === parsedCompareDate;
      case "not_equals":
        return parsedVariableDate !== parsedCompareDate;
      case "greater_than":
        return parsedVariableDate > parsedCompareDate;
      case "less_than":
        return parsedVariableDate < parsedCompareDate;
      case "greater_or_equal":
        return parsedVariableDate >= parsedCompareDate;
      case "less_or_equal":
        return parsedVariableDate <= parsedCompareDate;
      case "between": {
        if (parsedCompareDate2 === null) return false;
        return (
          parsedVariableDate >= parsedCompareDate &&
          parsedVariableDate <= parsedCompareDate2
        );
      }
      default:
        return false;
    }
  }

  if (variableType === "time") {
    const tv = timeToMinutes(String(varValue));
    const tc = timeToMinutes(compareValue);
    const tc2 = compareValue2 ? timeToMinutes(compareValue2) : null;
    if (tv === null || tc === null) return false;

    switch (operator) {
      case "equals": return tv === tc;
      case "not_equals": return tv !== tc;
      case "greater_than": return tv > tc;
      case "less_than": return tv < tc;
      case "greater_or_equal": return tv >= tc;
      case "less_or_equal": return tv <= tc;
      case "between": {
        if (tc2 === null) return false;
        if (tc <= tc2) return tv >= tc && tv <= tc2;
        return tv >= tc || tv <= tc2;
      }
      default: return false;
    }
  }

  if (Array.isArray(varValue)) {
    switch (operator) {
      case "contains":
        return varValue.some((item) =>
          String(item).toLowerCase().includes(compareValue.toLowerCase())
        );
      case "not_contains":
        return !varValue.some((item) =>
          String(item).toLowerCase().includes(compareValue.toLowerCase())
        );
      default:
        return false;
    }
  }

  const strValue = String(varValue);
  const numValue = Number(varValue);
  const compareNum = Number(compareValue);
  const compareNum2 = compareValue2 ? Number(compareValue2) : undefined;
  const strLower = strValue.toLowerCase();
  const compareLower = compareValue.toLowerCase();

  switch (operator) {
    case "equals":
      return strValue === compareValue;
    case "not_equals":
      return strValue !== compareValue;
    case "contains":
      return strLower.includes(compareLower);
    case "not_contains":
      return !strLower.includes(compareLower);
    case "starts_with":
      return strLower.startsWith(compareLower);
    case "ends_with":
      return strLower.endsWith(compareLower);
    case "greater_than":
      return !isNaN(numValue) && !isNaN(compareNum) && numValue > compareNum;
    case "less_than":
      return !isNaN(numValue) && !isNaN(compareNum) && numValue < compareNum;
    case "greater_or_equal":
      return !isNaN(numValue) && !isNaN(compareNum) && numValue >= compareNum;
    case "less_or_equal":
      return !isNaN(numValue) && !isNaN(compareNum) && numValue <= compareNum;
    case "between":
      return (
        !isNaN(numValue) &&
        !isNaN(compareNum) &&
        compareNum2 !== undefined &&
        !isNaN(compareNum2) &&
        numValue >= compareNum &&
        numValue <= compareNum2
      );
    default:
      return false;
  }
}

const operatorLabels: Record<string, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  contains: "contém",
  not_contains: "não contém",
  starts_with: "começa com",
  ends_with: "termina com",
  greater_than: "é maior que",
  less_than: "é menor que",
  greater_or_equal: "é maior ou igual a",
  less_or_equal: "é menor ou igual a",
  between: "está entre",
  is_empty: "está vazio",
  is_not_empty: "não está vazio",
  is_true: "é verdadeiro",
  is_false: "é falso",
  in_days: "inclui os dias",
  not_in_days: "não inclui os dias",
};

function getRuleDescription(rule: Rule, varValue: unknown): string {
  const operatorLabel = operatorLabels[rule.operator] || rule.operator;
  const valueStr = varValue !== undefined ? `"${varValue}"` : "indefinido";

  if (rule.variable === "system.day_of_week" && (rule.operator === "in_days" || rule.operator === "not_in_days")) {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const selectedNames = rule.value.split(",").filter(Boolean).map(d => dayNames[parseInt(d)] || d);
    return `${rule.variable} ${operatorLabel} [${selectedNames.join(", ")}] (valor: ${valueStr})`;
  }

  if (rule.operator === "is_empty" || rule.operator === "is_not_empty" ||
      rule.operator === "is_true" || rule.operator === "is_false") {
    return `${rule.variable} ${operatorLabel} (valor: ${valueStr})`;
  } else if (rule.operator === "between") {
    return `${rule.variable} ${operatorLabel} "${rule.value}" e "${rule.value2}" (valor: ${valueStr})`;
  } else {
    return `${rule.variable} ${operatorLabel} "${rule.value}" (valor: ${valueStr})`;
  }
}

export const conditionalExecutor: NodeExecutor = {
  canHandle: (nodeType) => nodeType === "conditional",

  execute: async (node: Node, context: ExecutionContext): Promise<ExecutionResult> => {
    const data = node.data as {
      conditions?: ConditionInput[];
      defaultBranch?: { id: string };
      label?: string;
    };

    const conditions = data.conditions ?? [];
    const defaultBranch = data.defaultBranch;

    context.addMessage({
      type: "system",
      content: "Avaliando condições...",
      nodeId: node.id,
    });

    for (const rawCondition of conditions) {
      const condition = normalizeCondition(rawCondition);
      const ruleDescriptions: string[] = [];
      const ruleResults: boolean[] = [];

      // Avalia todas as rules do grupo (AND)
      for (const rule of condition.rules) {
        let varValue = context.variables[rule.variable];

        if (rule.variable === "system.day_of_week") {
          const now = new Date();
          const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          varValue = String(spDate.getDay());
        }

        if (rule.variable === "system.current_time") {
          const formatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          varValue = formatter.format(new Date());
        }

        if (rule.variable === "system.current_date") {
          const formatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          varValue = formatter.format(new Date());
        }

        const result = evaluateRule(varValue, rule.operator, rule.value, rule.value2, rule.variableType);
        ruleResults.push(result);
        ruleDescriptions.push(`${getRuleDescription(rule, varValue)} → ${result ? "✓" : "✗"}`);
      }

      const allRulesTrue = ruleResults.every(r => r);
      const rulesText = condition.rules.length > 1
        ? `\n  ${ruleDescriptions.join("\n  E ")}`
        : ruleDescriptions[0];

      context.addLogEntry({
        nodeId: node.id,
        nodeType: "conditional",
        nodeLabel: (node.data as { label?: string })?.label ?? "Condicional",
        action: "enter",
        details: `Grupo "${condition.label}": ${rulesText}`,
      });

      if (allRulesTrue) {
        const successMessage = condition.rules.length > 1
          ? `Grupo "${condition.label}" satisfeito (todas as ${condition.rules.length} regras verdadeiras)`
          : `Condição satisfeita: ${ruleDescriptions[0]}`;

        context.addMessage({
          type: "system",
          content: successMessage,
          nodeId: node.id,
        });

        const nextNodeId = context.findNextNode(node.id, condition.id);
        return {
          nextNodeId,
          waitForInput: false,
        };
      }
    }

    context.addMessage({
      type: "system",
      content: "Nenhuma condição satisfeita, seguindo ramo padrão",
      nodeId: node.id,
    });

    const nextNodeId = defaultBranch
      ? context.findNextNode(node.id, defaultBranch.id)
      : context.findNextNode(node.id);

    return {
      nextNodeId,
      waitForInput: false,
    };
  },
};
