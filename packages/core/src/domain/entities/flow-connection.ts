import { InvalidCreation } from "../errors/invalid-creation";

export namespace FlowConnection {
  export interface Props {
    id: string;
    source: string;
    target: string;
    sourceHandle: string | null;
  }

  export interface Raw {
    id: string;
    source: string;
    target: string;
    sourceHandle: string | null;
  }

  export interface CreateProps {
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
  }
}

export class FlowConnection {
  public id: string;
  public source: string;
  public target: string;
  public sourceHandle: string | null;

  constructor(props: FlowConnection.Props) {
    this.id = props.id;
    this.source = props.source;
    this.target = props.target;
    this.sourceHandle = props.sourceHandle;
  }

  raw(): FlowConnection.Raw {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      sourceHandle: this.sourceHandle,
    };
  }

  static instance(props: FlowConnection.Props) {
    return new FlowConnection(props);
  }

  static fromRaw(props: FlowConnection.Raw) {
    return new FlowConnection({
      id: props.id,
      source: props.source,
      target: props.target,
      sourceHandle: props.sourceHandle,
    });
  }

  static create(props: FlowConnection.CreateProps) {
    if (!props.source || !props.target) {
      throw InvalidCreation.instance();
    }

    return new FlowConnection({
      id: props.id ?? crypto.randomUUID().toString(),
      source: props.source,
      target: props.target,
      sourceHandle: props.sourceHandle ?? null,
    });
  }
}
