export namespace CalculatorSettings {
  export interface Props {
    id: string;
    workspaceId: string;
    installmentNumber: number;
    interestRate: number;
    isEnabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    installmentNumber: number;
    interestRate: number;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    workspaceId: string;
    installmentNumber: number;
    interestRate: number;
    isEnabled?: boolean;
  }

  export interface UpdateProps {
    interestRate?: number;
    isEnabled?: boolean;
  }

  export interface BulkUpdateItem {
    installmentNumber: number;
    interestRate: number;
    isEnabled: boolean;
  }
}

export class CalculatorSettings {
  public id: string;
  public workspaceId: string;
  public installmentNumber: number;
  public interestRate: number;
  public isEnabled: boolean;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: CalculatorSettings.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.installmentNumber = props.installmentNumber;
    this.interestRate = props.interestRate;
    this.isEnabled = props.isEnabled;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  update(props: CalculatorSettings.UpdateProps): void {
    if (props.interestRate !== undefined) this.interestRate = props.interestRate;
    if (props.isEnabled !== undefined) this.isEnabled = props.isEnabled;
    this.updatedAt = new Date();
  }

  raw(): CalculatorSettings.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      installmentNumber: this.installmentNumber,
      interestRate: this.interestRate,
      isEnabled: this.isEnabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: CalculatorSettings.Props): CalculatorSettings {
    return new CalculatorSettings(props);
  }

  static create(props: CalculatorSettings.CreateProps): CalculatorSettings {
    return new CalculatorSettings({
      id: crypto.randomUUID(),
      workspaceId: props.workspaceId,
      installmentNumber: props.installmentNumber,
      interestRate: props.interestRate,
      isEnabled: props.isEnabled ?? true,
    });
  }

  static createDefaultSettings(workspaceId: string): CalculatorSettings[] {
    const defaultRates: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 2.99,
      5: 2.99,
      6: 2.99,
      7: 2.99,
      8: 2.99,
      9: 2.99,
      10: 2.99,
      11: 2.99,
      12: 2.99,
      13: 3.49,
      14: 3.49,
      15: 3.49,
      16: 3.49,
      17: 3.49,
      18: 3.49,
    };

    return Object.entries(defaultRates).map(([installment, rate]) =>
      CalculatorSettings.create({
        workspaceId,
        installmentNumber: parseInt(installment),
        interestRate: rate,
        isEnabled: true,
      })
    );
  }
}
