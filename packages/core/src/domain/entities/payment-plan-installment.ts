export namespace PaymentPlanInstallment {
  export interface Props {
    id: string;
    planId: string;
    installmentNumber: number;
    interestRate: number;
    additionalFee: number;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    planId: string;
    installmentNumber: number;
    interestRate: number;
    additionalFee: number;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    planId: string;
    installmentNumber: number;
    interestRate: number;
    additionalFee?: number;
    isEnabled?: boolean;
  }

  export interface UpdateProps {
    interestRate?: number;
    additionalFee?: number;
    isEnabled?: boolean;
  }

  export interface BulkItem {
    installmentNumber: number;
    interestRate: number;
    additionalFee: number;
    isEnabled: boolean;
  }
}

export class PaymentPlanInstallment {
  public id: string;
  public planId: string;
  public installmentNumber: number;
  public interestRate: number;
  public additionalFee: number;
  public isEnabled: boolean;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: PaymentPlanInstallment.Props) {
    this.id = props.id;
    this.planId = props.planId;
    this.installmentNumber = props.installmentNumber;
    this.interestRate = props.interestRate;
    this.additionalFee = props.additionalFee;
    this.isEnabled = props.isEnabled;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  update(props: PaymentPlanInstallment.UpdateProps): void {
    if (props.interestRate !== undefined) this.interestRate = props.interestRate;
    if (props.additionalFee !== undefined) this.additionalFee = props.additionalFee;
    if (props.isEnabled !== undefined) this.isEnabled = props.isEnabled;
    this.updatedAt = new Date();
  }

  raw(): PaymentPlanInstallment.Raw {
    return {
      id: this.id,
      planId: this.planId,
      installmentNumber: this.installmentNumber,
      interestRate: this.interestRate,
      additionalFee: this.additionalFee,
      isEnabled: this.isEnabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: PaymentPlanInstallment.Props): PaymentPlanInstallment {
    return new PaymentPlanInstallment(props);
  }

  static create(props: PaymentPlanInstallment.CreateProps): PaymentPlanInstallment {
    return new PaymentPlanInstallment({
      id: crypto.randomUUID(),
      planId: props.planId,
      installmentNumber: props.installmentNumber,
      interestRate: props.interestRate,
      additionalFee: props.additionalFee ?? 0,
      isEnabled: props.isEnabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static createDefaultInstallments(planId: string): PaymentPlanInstallment[] {
    const defaultRates: Record<number, number> = {
      1: 0, 2: 0, 3: 0,
      4: 2.99, 5: 2.99, 6: 2.99,
      7: 2.99, 8: 2.99, 9: 2.99,
      10: 2.99, 11: 2.99, 12: 2.99,
    };

    return Object.entries(defaultRates).map(([installment, rate]) =>
      PaymentPlanInstallment.create({
        planId,
        installmentNumber: parseInt(installment),
        interestRate: rate,
        additionalFee: 0,
        isEnabled: true,
      })
    );
  }
}
