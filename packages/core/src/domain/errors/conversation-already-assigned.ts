export class ConversationAlreadyAssigned extends Error {
  readonly code = "CONFLICT";

  constructor(attendantName?: string) {
    super(
      attendantName
        ? `Conversa ja atendida por ${attendantName}`
        : "Conversa ja atendida"
    );
    this.name = "ConversationAlreadyAssigned";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
    };
  }

  serialize(): string {
    return JSON.stringify(this.toJSON());
  }

  static throw(attendantName?: string) {
    return new ConversationAlreadyAssigned(attendantName);
  }
}
