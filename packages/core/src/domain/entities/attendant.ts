import { InvalidCreation } from "../errors/invalid-creation";

export namespace Attendant {
  export interface Props {
    id: string;
    name: string;
  }
}

export class Attendant {
  public readonly senderType: "attendant" = "attendant";
  public id: string;
  public name: string;
  constructor(props: Attendant.Props) {
    this.id = props.id;
    this.name = props.name;
  }
  raw(): Attendant.Props {
    return {
      id: this.id,
      name: this.name,
    };
  }
  static create(props: Attendant.Props) {
    if (!props.id || !props.name) throw InvalidCreation.instance();
    return new Attendant(props);
  }
}
