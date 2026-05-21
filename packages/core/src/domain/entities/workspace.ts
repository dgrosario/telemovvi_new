import { InvalidCreation } from "../errors/invalid-creation";

export namespace Workspace {
  export interface Props {
    id: string;
    name: string;
  }
}

export class Workspace {
  public id: string;
  public name: string;
  constructor(props: Workspace.Props) {
    this.id = props.id;
    this.name = props.name;
  }

  static instance(props: Workspace.Props) {
    return new Workspace(props);
  }
  static create(name: string) {
    if (!name) throw InvalidCreation.instance();
    return new Workspace({
      id: crypto.randomUUID().toString(),
      name,
    });
  }
}
