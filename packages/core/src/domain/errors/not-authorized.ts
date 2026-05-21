export class NotAuthorized extends Error {
  constructor(permissions?: string) {
    super(`Sem autorização ${permissions}`);
    this.name = "NotAuthorized";
  }

  static throw(permissions?: string[]) {
    return new NotAuthorized(permissions?.join(", "));
  }
}
