export namespace SystemVariable {
  export type ResolverType =
    | "contact_field"
    | "attendant_field"
    | "time_based"
    | "current_time"
    | "current_date"
    | "day_of_week"
    | "conversation_field"
    | "custom";

  export interface ResolverConfig {
    field?: string;
    timezone?: string;
    format?: string;
    type?: string;
    value?: string;
  }

  export interface Props {
    id: string;
    key: string;
    label: string;
    description?: string | null;
    resolverType: ResolverType;
    resolverConfig: ResolverConfig;
    workspaceId?: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }

  export interface Raw {
    id: string;
    key: string;
    label: string;
    description: string | null;
    resolverType: ResolverType;
    resolverConfig: ResolverConfig;
    workspaceId: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    key: string;
    label: string;
    description?: string | null;
    resolverType: ResolverType;
    resolverConfig: ResolverConfig;
    workspaceId?: string | null;
    isSystem?: boolean;
  }

  export interface UpdateProps {
    label?: string;
    description?: string | null;
    resolverConfig?: ResolverConfig;
    isActive?: boolean;
  }
}

export class SystemVariable {
  public id: string;
  public key: string;
  public label: string;
  public description: string | null;
  public resolverType: SystemVariable.ResolverType;
  public resolverConfig: SystemVariable.ResolverConfig;
  public workspaceId: string | null;
  public isSystem: boolean;
  public isActive: boolean;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: SystemVariable.Props) {
    this.id = props.id;
    this.key = props.key;
    this.label = props.label;
    this.description = props.description ?? null;
    this.resolverType = props.resolverType;
    this.resolverConfig = props.resolverConfig;
    this.workspaceId = props.workspaceId ?? null;
    this.isSystem = props.isSystem;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  get placeholder(): string {
    return `{{${this.key}}}`;
  }

  update(props: SystemVariable.UpdateProps): void {
    if (props.label !== undefined) this.label = props.label;
    if (props.description !== undefined)
      this.description = props.description ?? null;
    if (props.resolverConfig !== undefined)
      this.resolverConfig = props.resolverConfig;
    if (props.isActive !== undefined) this.isActive = props.isActive;
    this.updatedAt = new Date();
  }

  raw(): SystemVariable.Raw {
    return {
      id: this.id,
      key: this.key,
      label: this.label,
      description: this.description,
      resolverType: this.resolverType,
      resolverConfig: this.resolverConfig,
      workspaceId: this.workspaceId,
      isSystem: this.isSystem,
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: SystemVariable.Props): SystemVariable {
    return new SystemVariable(props);
  }

  static create(props: SystemVariable.CreateProps): SystemVariable {
    const normalizedKey = props.key
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase();

    return new SystemVariable({
      id: crypto.randomUUID(),
      key: normalizedKey,
      label: props.label,
      description: props.description,
      resolverType: props.resolverType,
      resolverConfig: props.resolverConfig,
      workspaceId: props.workspaceId,
      isSystem: props.isSystem ?? false,
      isActive: true,
    });
  }
}
