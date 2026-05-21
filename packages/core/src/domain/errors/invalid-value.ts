export class InvalidValue extends Error {
  constructor() {
    super("Valor inválido!");
    this.name = "InvalidValue";
  }

  static throw() {
    return new InvalidValue();
  }
}
