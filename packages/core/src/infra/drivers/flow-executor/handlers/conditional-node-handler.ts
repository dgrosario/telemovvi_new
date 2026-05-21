import { FlowNode } from "../../../../domain/entities/flow-node";
import { Partner } from "../../../../domain/entities/partner";
import { PartnersDatabaseRepository } from "../../../repositories/partners-repository";
import { PartnersLabelsDatabaseRepository } from "../../../repositories/partners-labels-repository";
import { ExecutionContext, ExecutionResult, NodeHandler } from "../types";

interface PartnersRepository {
  retrieveByPartnerContactIdWithWorkspace(
    partnerContactId: string
  ): Promise<{ partner: Partner; workspaceId: string } | null>;
}

interface PartnersLabelsRepository {
  listLabelsByPartner(partnerId: string, workspaceId: string): Promise<{ id: string; name: string; color: string }[]>;
}

type VariableValue = string | string[] | undefined;

export class ConditionalNodeHandler implements NodeHandler {
  constructor(
    private readonly partnersRepository: PartnersRepository,
    private readonly partnersLabelsRepository: PartnersLabelsRepository
  ) {}

  canHandle(nodeType: FlowNode.Type): boolean {
    return nodeType === "conditional";
  }

  private timeToMinutes(timeStr: string): number | null {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match?.[1] || !match[2]) return null;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  private getCurrentDayOfWeek(): string {
    const now = new Date();
    const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return String(spDate.getDay());
  }

  private getCurrentTime(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(now);
  }

  private getCurrentDate(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return formatter.format(now);
  }

  private parseDateToTimestamp(dateStr: string): number | null {
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

  private async getPartner(context: ExecutionContext): Promise<Partner | null> {
    const contactId = context.conversation.contact?.id;
    if (!contactId) return null;

    const cached = context.cache.partners.get(contactId);
    if (cached !== undefined) {
      return cached;
    }

    const result =
      await this.partnersRepository.retrieveByPartnerContactIdWithWorkspace(
        contactId
      );

    const partner = result?.partner ?? null;
    context.cache.partners.set(contactId, partner);
    return partner;
  }

  private async getVariableValue(
    variablePath: string,
    context: ExecutionContext
  ): Promise<VariableValue> {
    const variables = context.flowExecution.variables as Record<string, unknown>;

    switch (variablePath) {
      case "partner.name":
      case "contact.name":
        return context.conversation.contact?.name;

      case "partner.tags": {
        // Legacy - deprecated, use partner.labels instead
        return [];
      }

      case "partner.labels": {
        const partner = await this.getPartner(context);
        if (!partner) return [];
        const labels = await this.partnersLabelsRepository.listLabelsByPartner(partner.id, context.workspaceId);
        return labels.map(label => label.name);
      }

      case "user.message":
      case "message":
        return context.userMessage;

      case "partner.phone":
      case "user.phone":
        return context.conversation.contact?.value;

      case "conversation.channel":
        return context.channel.type;

      case "conversation.sector":
        return context.conversation.sector?.id;

      case "system.day_of_week":
        return this.getCurrentDayOfWeek();

      case "system.current_time":
        return this.getCurrentTime();

      case "system.current_date":
        return this.getCurrentDate();

      default:
        if (variablePath.startsWith("flow.")) {
          const varName = variablePath.replace("flow.", "");
          return variables[varName]?.toString();
        }
        if (variables[variablePath] !== undefined && variables[variablePath] !== null) {
          return variables[variablePath]?.toString();
        }
        if (context.resolvedSystemVariables[variablePath] !== undefined) {
          return context.resolvedSystemVariables[variablePath];
        }
        return undefined;
    }
  }

  private async evaluateRule(
    rule: FlowNode.ConditionalRule,
    context: ExecutionContext
  ): Promise<boolean> {
    const variableValue = await this.getVariableValue(rule.variable, context);
    const compare = String(rule.value || "");
    const compare2 = rule.value2 ? String(rule.value2) : undefined;
    const isArrayVariable = rule.variableType === "array" || Array.isArray(variableValue);

    if (rule.operator === "is_empty") {
      if (isArrayVariable && Array.isArray(variableValue)) {
        return variableValue.length === 0;
      }
      return variableValue === undefined || variableValue === null || variableValue === "";
    }

    if (rule.operator === "is_not_empty") {
      if (isArrayVariable && Array.isArray(variableValue)) {
        return variableValue.length > 0;
      }
      return variableValue !== undefined && variableValue !== null && variableValue !== "";
    }

    if (rule.operator === "is_true") {
      return variableValue === "true" || variableValue === "1";
    }

    if (rule.operator === "is_false") {
      return variableValue === "false" || variableValue === "0" || variableValue === undefined;
    }

    if (rule.operator === "in_days") {
      const selectedDays = compare.split(",").map(d => d.trim());
      return selectedDays.includes(String(variableValue));
    }

    if (rule.operator === "not_in_days") {
      const selectedDays = compare.split(",").map(d => d.trim());
      return !selectedDays.includes(String(variableValue));
    }

    if (variableValue === undefined || variableValue === null) {
      return false;
    }

    const parsedVariableDate = this.parseDateToTimestamp(String(variableValue));
    const parsedCompareDate = this.parseDateToTimestamp(compare);
    const parsedCompareDate2 = compare2
      ? this.parseDateToTimestamp(compare2)
      : null;
    const isDateRule =
      rule.variableType === "date" ||
      rule.variable === "system.current_date" ||
      (parsedVariableDate !== null && parsedCompareDate !== null);

    if (isDateRule) {
      if (parsedVariableDate === null || parsedCompareDate === null) return false;

      switch (rule.operator) {
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

    if (rule.variableType === "time") {
      const timeValue = this.timeToMinutes(String(variableValue));
      const timeCompare = this.timeToMinutes(compare);
      const timeCompare2 = compare2 ? this.timeToMinutes(compare2) : null;

      if (timeValue === null || timeCompare === null) return false;

      switch (rule.operator) {
        case "equals": return timeValue === timeCompare;
        case "not_equals": return timeValue !== timeCompare;
        case "greater_than": return timeValue > timeCompare;
        case "less_than": return timeValue < timeCompare;
        case "greater_or_equal": return timeValue >= timeCompare;
        case "less_or_equal": return timeValue <= timeCompare;
        case "between": {
          if (timeCompare2 === null) return false;
          if (timeCompare <= timeCompare2) {
            return timeValue >= timeCompare && timeValue <= timeCompare2;
          }
          return timeValue >= timeCompare || timeValue <= timeCompare2;
        }
        default: return false;
      }
    }

    if (rule.operator === "contains") {
      if (isArrayVariable && Array.isArray(variableValue)) {
        return variableValue.some(
          (item) => item.toLowerCase() === compare.toLowerCase()
        );
      }
      const value = String(variableValue);
      return value.toLowerCase().includes(compare.toLowerCase());
    }

    if (rule.operator === "not_contains") {
      if (isArrayVariable && Array.isArray(variableValue)) {
        return !variableValue.some(
          (item) => item.toLowerCase() === compare.toLowerCase()
        );
      }
      const value = String(variableValue);
      return !value.toLowerCase().includes(compare.toLowerCase());
    }

    const value = String(variableValue);

    switch (rule.operator) {
      case "equals":
        return value === compare;

      case "not_equals":
        return value !== compare;

      case "starts_with":
        return value.toLowerCase().startsWith(compare.toLowerCase());

      case "ends_with":
        return value.toLowerCase().endsWith(compare.toLowerCase());

      case "greater_than": {
        const numValue = parseFloat(value);
        const numCompare = parseFloat(compare);
        if (isNaN(numValue) || isNaN(numCompare)) return false;
        return numValue > numCompare;
      }

      case "less_than": {
        const numValue = parseFloat(value);
        const numCompare = parseFloat(compare);
        if (isNaN(numValue) || isNaN(numCompare)) return false;
        return numValue < numCompare;
      }

      case "greater_or_equal": {
        const numValue = parseFloat(value);
        const numCompare = parseFloat(compare);
        if (isNaN(numValue) || isNaN(numCompare)) return false;
        return numValue >= numCompare;
      }

      case "less_or_equal": {
        const numValue = parseFloat(value);
        const numCompare = parseFloat(compare);
        if (isNaN(numValue) || isNaN(numCompare)) return false;
        return numValue <= numCompare;
      }

      case "between": {
        const numValue = parseFloat(value);
        const numMin = parseFloat(compare);
        const numMax = compare2 ? parseFloat(compare2) : NaN;
        if (isNaN(numValue) || isNaN(numMin) || isNaN(numMax)) return false;
        return numValue >= numMin && numValue <= numMax;
      }

      default:
        return false;
    }
  }

  private isLegacyCondition(
    condition: FlowNode.ConditionalConditionInput
  ): condition is FlowNode.LegacyConditionalCondition {
    return "variable" in condition && !("rules" in condition);
  }

  private normalizeCondition(
    condition: FlowNode.ConditionalConditionInput
  ): FlowNode.ConditionalCondition {
    if (this.isLegacyCondition(condition)) {
      return {
        id: condition.id,
        label: condition.label,
        rules: [{
          id: crypto.randomUUID(),
          variable: condition.variable,
          operator: condition.operator,
          value: condition.value,
        }],
      };
    }
    return condition;
  }

  private async evaluateCondition(
    condition: FlowNode.ConditionalCondition,
    context: ExecutionContext
  ): Promise<boolean> {
    for (const rule of condition.rules) {
      const result = await this.evaluateRule(rule, context);
      if (!result) return false;
    }
    return true;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const nodeData = context.currentNode.data as FlowNode.ConditionalData;

    if (!nodeData.conditions || nodeData.conditions.length === 0) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error: "No conditions defined",
      };
    }

    try {
      for (const rawCondition of nodeData.conditions) {
        const condition = this.normalizeCondition(rawCondition);
        const isTrue = await this.evaluateCondition(condition, context);

        if (isTrue) {
          return {
            success: true,
            shouldPause: false,
            nextNodeId: condition.id,
          };
        }
      }

      // Se nenhuma condição foi verdadeira, verificar se há saída padrão
      if (nodeData.defaultBranch?.id) {
        return {
          success: true,
          shouldPause: false,
          nextNodeId: nodeData.defaultBranch.id,
        };
      }

      // Se não há saída padrão e nenhuma condição foi verdadeira, pausar o fluxo
      return {
        success: true,
        shouldPause: true,
        nextNodeId: null,
      };
    } catch (error) {
      return {
        success: false,
        shouldPause: false,
        nextNodeId: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to evaluate conditions",
      };
    }
  }

  static instance() {
    return new ConditionalNodeHandler(
      PartnersDatabaseRepository.instance(),
      PartnersLabelsDatabaseRepository.instance()
    );
  }
}
