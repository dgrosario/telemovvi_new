import { InvalidCreation } from "../errors/invalid-creation";

export type PaymentMethodValue =
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CHECK"
  | "DIGITAL_PAYMENT";

export class PaymentMethod {
  static values = [
    "CASH",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "CHECK",
    "DIGITAL_PAYMENT",
  ] as const;

  constructor(readonly value: PaymentMethodValue) {}

  raw(): PaymentMethodValue {
    return this.value;
  }

  get formatted() {
    const formatteds = new Map<PaymentMethodValue, string>([
      ["CASH", "Dinheiro"],
      ["CHECK", "Cheque"],
      ["CREDIT_CARD", "Cartão de crédito"],
      ["DEBIT_CARD", "Cartão de débito"],
      ["DIGITAL_PAYMENT", "Pix"],
    ]);

    return formatteds.get(this.value) ?? "";
  }

  private validate() {
    if (!PaymentMethod.values.includes(this.value))
      throw InvalidCreation.instance();
  }

  static create(type: PaymentMethodValue) {
    const instance = new PaymentMethod(type);
    instance.validate();
    return instance;
  }
}
