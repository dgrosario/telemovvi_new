export class InvalidCreation extends Error {
  constructor(message?: string) {
    super(message || "Criação inválida");
    this.name = "InvalidCreation";
  }

  static instance(message?: string) {
    throw new InvalidCreation(message);
  }
}
