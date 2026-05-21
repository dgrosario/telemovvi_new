import { SystemVariable } from "../entities/system-variable";

export interface VariableResolutionContext {
  contact?: {
    name: string;
    value?: string;
  };
  attendant?: {
    id: string;
    name: string;
    sectorName?: string;
  };
  workspace?: {
    id: string;
    name: string;
  };
  conversation?: {
    id: string;
  };
}

export class VariableResolverService {
  private readonly timezone = "America/Sao_Paulo";

  resolve(
    variable: SystemVariable,
    context: VariableResolutionContext
  ): string {
    switch (variable.resolverType) {
      case "contact_field":
        return this.resolveContactField(variable, context);
      case "attendant_field":
        return this.resolveAttendantField(variable, context);
      case "time_based":
        return this.resolveTimeBased(variable);
      case "current_time":
        return this.resolveCurrentTime(variable);
      case "current_date":
        return this.resolveCurrentDate(variable);
      case "day_of_week":
        return this.resolveDayOfWeek(variable);
      case "conversation_field":
        return this.resolveConversationField(variable, context);
      case "custom":
        return this.resolveCustom(variable);
      default:
        return variable.placeholder;
    }
  }

  private resolveContactField(
    variable: SystemVariable,
    context: VariableResolutionContext
  ): string {
    const field = variable.resolverConfig.field ?? "name";
    const contact = context.contact;
    if (!contact) return "";

    if (field === "firstName") {
      const parts = (contact.name ?? "").split(" ");
      return parts[0] ?? "";
    }

    if (field === "lastName") {
      const parts = (contact.name ?? "").split(" ");
      return parts.slice(1).join(" ");
    }

    const value = contact[field as keyof typeof contact];
    return typeof value === "string" ? value : "";
  }

  private resolveAttendantField(
    variable: SystemVariable,
    context: VariableResolutionContext
  ): string {
    const field = variable.resolverConfig.field ?? "name";
    const attendant = context.attendant;
    if (!attendant) return "";
    const value = attendant[field as keyof typeof attendant];
    return typeof value === "string" ? value : "";
  }

  private resolveTimeBased(variable: SystemVariable): string {
    const timezone = variable.resolverConfig.timezone ?? this.timezone;
    const type = variable.resolverConfig.type ?? "greeting";

    if (type === "greeting") {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: timezone,
        hour: "numeric",
      });
      const hour = parseInt(formatter.format(now), 10);

      if (hour >= 5 && hour < 12) return "Bom dia";
      if (hour >= 12 && hour < 18) return "Boa tarde";
      return "Boa noite";
    }

    return "";
  }

  private resolveCurrentTime(variable: SystemVariable): string {
    const timezone = variable.resolverConfig.timezone ?? this.timezone;
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });

    return formatter.format(now);
  }

  private resolveCurrentDate(variable: SystemVariable): string {
    const timezone = variable.resolverConfig.timezone ?? this.timezone;
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return formatter.format(now);
  }

  private resolveDayOfWeek(variable: SystemVariable): string {
    const timezone = variable.resolverConfig.timezone ?? this.timezone;
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      weekday: "long",
    });

    const dayOfWeek = formatter.format(now);
    return dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  }

  private resolveConversationField(
    variable: SystemVariable,
    context: VariableResolutionContext
  ): string {
    const field = variable.resolverConfig.field ?? "id";
    const conversation = context.conversation;
    if (!conversation) return "";
    const value = conversation[field as keyof typeof conversation];
    return typeof value === "string" ? value : "";
  }

  private resolveCustom(variable: SystemVariable): string {
    return variable.resolverConfig.value ?? "";
  }

  resolveAll(
    content: string,
    variables: SystemVariable[],
    context: VariableResolutionContext
  ): string {
    let result = content;

    for (const variable of variables) {
      if (!variable.isActive) continue;
      const resolvedValue = this.resolve(variable, context);
      result = result.replace(
        new RegExp(this.escapeRegExp(variable.placeholder), "gim"),
        resolvedValue
      );
    }

    return result;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static buildContext(
    conversation: {
      contact?: { name: string; value?: string } | null;
      attendant?: { id: string; name: string } | null;
      sector?: { name: string } | null;
      id: string;
    },
    workspaceId: string,
    workspaceName?: string
  ): VariableResolutionContext {
    return {
      contact: conversation.contact
        ? {
            name: conversation.contact.name,
            value: conversation.contact.value,
          }
        : undefined,
      attendant: conversation.attendant
        ? {
            id: conversation.attendant.id,
            name: conversation.attendant.name,
            sectorName: conversation.sector?.name,
          }
        : undefined,
      workspace: {
        id: workspaceId,
        name: workspaceName ?? "",
      },
      conversation: {
        id: conversation.id,
      },
    };
  }

  static instance(): VariableResolverService {
    return new VariableResolverService();
  }
}
