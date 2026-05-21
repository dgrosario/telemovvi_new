import { InvalidCreation } from "../errors/invalid-creation";
import { FlowConnection } from "./flow-connection";
import { FlowNode } from "./flow-node";

export namespace Flow {
  export type Status = "active" | "inactive" | "draft";

  export interface Props {
    id: string;
    workspaceId: string;
    name: string;
    status: Status;
    nodes: FlowNode[];
    connections: FlowConnection[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    name: string;
    status: Status;
    nodes: FlowNode.Raw[];
    connections: FlowConnection.Raw[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface CreateProps {
    workspaceId: string;
    name: string;
    status?: Status;
  }
}

export class Flow {
  public id: string;
  public workspaceId: string;
  public name: string;
  public status: Flow.Status;
  public nodes: FlowNode[];
  public connections: FlowConnection[];
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: Flow.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.status = props.status;
    this.nodes = props.nodes;
    this.connections = props.connections;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  activate() {
    this.status = "active";
    this.updatedAt = new Date();
    return this;
  }

  deactivate() {
    this.status = "inactive";
    this.updatedAt = new Date();
    return this;
  }

  updateName(name: string) {
    if (!name || name.trim().length === 0) {
      throw new Error("Flow name cannot be empty");
    }
    this.name = name.trim();
    this.updatedAt = new Date();
    return this;
  }

  updateNodesAndConnections(nodes: FlowNode[], connections: FlowConnection[]) {
    this.nodes = nodes;
    this.connections = connections;
    this.updatedAt = new Date();
    return this;
  }

  raw(): Flow.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      status: this.status,
      nodes: this.nodes.map(node => node.raw()),
      connections: this.connections.map(conn => conn.raw()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static instance(props: Flow.Props) {
    return new Flow(props);
  }

  static fromRaw(props: Flow.Raw) {
    return new Flow({
      id: props.id,
      workspaceId: props.workspaceId,
      name: props.name,
      status: props.status,
      nodes: props.nodes.map(node => FlowNode.fromRaw(node)),
      connections: props.connections.map(conn => FlowConnection.fromRaw(conn)),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  static create(props: Flow.CreateProps) {
    if (!props.workspaceId || !props.name) {
      throw InvalidCreation.instance();
    }

    const now = new Date();

    return new Flow({
      id: crypto.randomUUID().toString(),
      workspaceId: props.workspaceId,
      name: props.name.trim(),
      status: props.status ?? "draft",
      nodes: [],
      connections: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
