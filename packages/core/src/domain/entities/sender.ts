import { InvalidCreation } from "../errors/invalid-creation";

export namespace Sender {
  export type Type = "attendant" | "contact";
  export interface Props {
    id: string;
    name: string;
    type: Type;
  }
}

export class Sender {
  public type: Sender.Type;
  public id: string;
  public name: string;

  constructor(props: Sender.Props) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
  }

  raw(): Sender.Props {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
    };
  }

  static create(type: Sender.Type, id: string, name: string) {
    if (!id || !name) throw InvalidCreation.instance();
    return new Sender({
      type: type ?? "attendant",
      id,
      name,
    });
  }
}
