export namespace CalculatorMessage {
  export interface Props {
    id: string;
    workspaceId: string;
    footerMessage: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    workspaceId: string;
    footerMessage: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    workspaceId: string;
    footerMessage?: string;
  }

  export interface UpdateProps {
    footerMessage?: string;
  }
}

const DEFAULT_FOOTER_MESSAGE = "Valores sujeitos a alteração. Consulte condições.";

export class CalculatorMessage {
  public id: string;
  public workspaceId: string;
  public footerMessage: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: CalculatorMessage.Props) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.footerMessage = props.footerMessage;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  update(props: CalculatorMessage.UpdateProps): void {
    if (props.footerMessage !== undefined) this.footerMessage = props.footerMessage;
    this.updatedAt = new Date();
  }

  raw(): CalculatorMessage.Raw {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      footerMessage: this.footerMessage,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static instance(props: CalculatorMessage.Props): CalculatorMessage {
    return new CalculatorMessage(props);
  }

  static create(props: CalculatorMessage.CreateProps): CalculatorMessage {
    return new CalculatorMessage({
      id: crypto.randomUUID(),
      workspaceId: props.workspaceId,
      footerMessage: props.footerMessage ?? DEFAULT_FOOTER_MESSAGE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static getDefaultFooterMessage(): string {
    return DEFAULT_FOOTER_MESSAGE;
  }
}
