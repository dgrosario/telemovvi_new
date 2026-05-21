export class NotFound extends Error {
  constructor(resource?: string) {
    super(resource ? `Not found: ${resource}` : "Not found");
    this.name = "NotFound";
  }
  static throw(resource?: string) {
    return new NotFound(resource);
  }
}
