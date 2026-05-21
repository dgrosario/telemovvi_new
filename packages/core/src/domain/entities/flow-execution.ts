import { InvalidCreation } from "../errors/invalid-creation";

export namespace FlowExecution {
  export type Status = "running" | "completed" | "failed" | "paused";

  export interface Variables {
    [key: string]: string | number | boolean;
  }

  export interface Props {
    id: string;
    flowId: string;
    conversationId: string;
    currentNodeId: string | null;
    status: Status;
    variables: Variables;
    startedAt: Date;
    completedAt: Date | null;
    failedAt: Date | null;
    errorMessage: string | null;
  }

  export interface Raw {
    id: string;
    flowId: string;
    conversationId: string;
    currentNodeId: string | null;
    status: Status;
    variables: Variables;
    startedAt: Date;
    completedAt: Date | null;
    failedAt: Date | null;
    errorMessage: string | null;
  }

  export interface CreateProps {
    flowId: string;
    conversationId: string;
    initialNodeId?: string | null;
  }
}

export class FlowExecution {
  public id: string;
  public flowId: string;
  public conversationId: string;
  public currentNodeId: string | null;
  public status: FlowExecution.Status;
  public variables: FlowExecution.Variables;
  public startedAt: Date;
  public completedAt: Date | null;
  public failedAt: Date | null;
  public errorMessage: string | null;

  constructor(props: FlowExecution.Props) {
    this.id = props.id;
    this.flowId = props.flowId;
    this.conversationId = props.conversationId;
    this.currentNodeId = props.currentNodeId;
    this.status = props.status;
    this.variables = props.variables;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.failedAt = props.failedAt;
    this.errorMessage = props.errorMessage;
  }

  moveToNode(nodeId: string) {
    this.currentNodeId = nodeId;
    return this;
  }

  pause() {
    this.status = "paused";
    return this;
  }

  resume() {
    if (this.status === "paused") {
      this.status = "running";
    }
    return this;
  }

  complete() {
    this.status = "completed";
    this.completedAt = new Date();
    this.currentNodeId = null;
    return this;
  }

  fail(errorMessage: string) {
    this.status = "failed";
    this.failedAt = new Date();
    this.errorMessage = errorMessage;
    return this;
  }

  setVariable(key: string, value: string | number | boolean) {
    this.variables[key] = value;
    return this;
  }

  getVariable(key: string): string | number | boolean | undefined {
    return this.variables[key];
  }

  deleteVariable(key: string) {
    delete this.variables[key];
    return this;
  }

  raw(): FlowExecution.Raw {
    return {
      id: this.id,
      flowId: this.flowId,
      conversationId: this.conversationId,
      currentNodeId: this.currentNodeId,
      status: this.status,
      variables: this.variables,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      errorMessage: this.errorMessage,
    };
  }

  static instance(props: FlowExecution.Props) {
    return new FlowExecution(props);
  }

  static fromRaw(props: FlowExecution.Raw) {
    return new FlowExecution({
      id: props.id,
      flowId: props.flowId,
      conversationId: props.conversationId,
      currentNodeId: props.currentNodeId,
      status: props.status,
      variables: props.variables,
      startedAt: props.startedAt,
      completedAt: props.completedAt,
      failedAt: props.failedAt,
      errorMessage: props.errorMessage,
    });
  }

  static create(props: FlowExecution.CreateProps) {
    if (!props.flowId || !props.conversationId) {
      throw InvalidCreation.instance();
    }

    return new FlowExecution({
      id: crypto.randomUUID().toString(),
      flowId: props.flowId,
      conversationId: props.conversationId,
      currentNodeId: props.initialNodeId ?? null,
      status: "running",
      variables: {},
      startedAt: new Date(),
      completedAt: null,
      failedAt: null,
      errorMessage: null,
    });
  }
}
