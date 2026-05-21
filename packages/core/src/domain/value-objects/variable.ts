import { Partner } from "../entities/partner";

export type VariableRaw = {
  name: string;
};

type Payload = {
  contact: {
    name: string;
  };
};

type ResolveValue = (payload: Payload) => string;

export class Variable {
  constructor(
    readonly name: string,
    readonly resolveValue: ResolveValue
  ) {}

  get value() {
    return `{{${this.name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s/gim, "_")
      .toLowerCase()}}}`;
  }

  resolve(content: string, payload: Payload) {
    return content.replace(
      new RegExp(this.value, "gim"),
      this.resolveValue(payload)
    );
  }

  raw() {
    return {
      name: this.name,
    };
  }

  static create(name: string, resolveValue: ResolveValue) {
    return new Variable(name, resolveValue);
  }
}

export const variablesAvailable = [
  Variable.create("Nome Contato", (payload) => payload.contact.name),
];

export const createResolverVariable =
  (payload: Payload) => (content: string) => {
    for (const variable of variablesAvailable) {
      content = variable.resolve(content, payload);
    }
    return content;
  };
