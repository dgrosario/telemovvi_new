export namespace PaymentPlan {
  export interface Props {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    workspaceId: string;
    name: string;
    description?: string | null;
    isDefault?: boolean;
    isEnabled?: boolean;
  }

  export interface UpdateProps {
    name?: string;
    description?: string | null;
    isDefault?: boolean;
    isEnabled?: boolean;
  }
}

export class PaymentPlan {
  public id: string;
  public workspaceId: string;
  public name: string;
  public description: string | null;
  public isDefault: boolean;
  public isEnabled: boolean;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: PaymentPlan.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.description = props.description;
    this.isDefault = props.isDefault;
    this.isEnabled = props.isEnabled;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  update(props: PaymentPlan.UpdateProps): void {
    if (props.name !== undefined) this.name = props.name;
    if (props.description !== undefined) this.description = props.description;
    if (props.isDefault !== undefined) this.isDefault = props.isDefault;
    if (props.isEnabled !== undefined) this.isEnabled = props.isEnabled;
    this.updatedAt = new Date();
  }

  raw(): PaymentPlan.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      description: this.description,
      isDefault: this.isDefault,
      isEnabled: this.isEnabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: PaymentPlan.Props): PaymentPlan {
    return new PaymentPlan(props);
  }

  static create(props: PaymentPlan.CreateProps): PaymentPlan {
    return new PaymentPlan({
      id: crypto.randomUUID(),
      workspaceId: props.workspaceId,
      name: props.name,
      description: props.description ?? null,
      isDefault: props.isDefault ?? false,
      isEnabled: props.isEnabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
