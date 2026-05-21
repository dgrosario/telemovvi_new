import { InvalidCreation } from "../errors/invalid-creation";

export namespace FlowNode {
  export type Type = "start" | "message" | "menu" | "interval" | "transfer" | "template" | "conditional" | "action" | "subflow" | "random" | "input" | "end";

  export type ActionType =
    | "tag_contact"
    | "assign_conversation"
    | "set_variable"
    | "close_conversation"
    | "send_message"
    | "send_template"
    | "transfer"
    | "pause_flow"
    | "capture_input";
  export type TagOperation = "add" | "remove" | "set";
  export type MessageType = "text" | "audio" | "image" | "document";
  export type PauseUnit = "minutes" | "hours" | "days";

  export interface Position {
    x: number;
    y: number;
  }

  export interface BaseData {
    label?: string;
  }

  export type TriggerStatus = "waiting" | "open" | "closed" | "expired";

  export interface StartData extends BaseData {
    triggerOnStatuses?: TriggerStatus[];
    allowConversationsWithoutSector?: boolean;
  }

  export interface MessageData extends BaseData {
    content: string;
  }

  export type MenuDisplayMode = "auto" | "text" | "buttons" | "list";

  export interface MenuOption {
    id: string;
    label: string;
    value: string;
    description?: string;
  }

  export interface MenuData extends BaseData {
    content: string;
    header?: string;
    footer?: string;
    buttonText?: string;
    displayMode?: MenuDisplayMode;
    options: MenuOption[];
  }

  export interface IntervalData extends BaseData {
    delay: number;
  }

  export interface TransferData extends BaseData {
    sectorId: string | null;
  }

  export interface TemplateData extends BaseData {
    templateId: string;
    templateName?: string;
    channelId: string;
    variableMapping: Record<
      string,
      {
        source: "auto" | "manual";
        value: string;
      }
    >;
  }

  export type ConditionalOperator =
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "greater_than"
    | "less_than"
    | "greater_or_equal"
    | "less_or_equal"
    | "between"
    | "is_empty"
    | "is_not_empty"
    | "is_true"
    | "is_false"
    | "in_days"
    | "not_in_days";

  export interface ConditionalRule {
    id: string;
    variable: string;
    operator: ConditionalOperator;
    value: string;
    value2?: string;
    variableType?: "string" | "number" | "array" | "day_of_week" | "time" | "date";
  }

  export interface ConditionalCondition {
    id: string;
    label: string;
    rules: ConditionalRule[];
  }

  export interface LegacyConditionalCondition {
    id: string;
    variable: string;
    operator: ConditionalOperator;
    value: string;
    label: string;
  }

  export type ConditionalConditionInput = ConditionalCondition | LegacyConditionalCondition;

  export interface ConditionalData extends BaseData {
    conditions: ConditionalConditionInput[];
    defaultBranch: {
      id: string;
      label: string;
    };
  }

  export interface SingleActionData {
    id: string;
    actionType: ActionType;
    // tag_contact fields (legacy - use labelIds for new flows)
    tagOperation?: TagOperation;
    tags?: string[];
    // label_contact fields (new system)
    labelIds?: string[];
    // assign_conversation fields
    attendantId?: string | null;
    attendantName?: string | null;
    // set_variable fields
    variableName?: string;
    variableValue?: string;
    // send_message fields
    content?: string;
    messageType?: MessageType;
    mediaUrl?: string;
    mediaName?: string;
    mediaMimeType?: string;
    // send_template fields
    templateId?: string;
    templateName?: string;
    channelId?: string;
    variableMapping?: Record<
      string,
      {
        source: "auto" | "manual";
        value: string;
      }
    >;
    // transfer fields
    sectorId?: string | null;
    sectorName?: string | null;
    // pause_flow fields
    pauseDuration?: number;
    pauseUnit?: PauseUnit;
    // capture_input fields
    question?: string;
    inputValidationType?: InputValidationType;
    inputOptions?: string[];
    errorMessage?: string;
    maxAttempts?: number;
    saveToContact?: boolean;
    contactField?: InputContactField;
  }

  export interface ActionData extends BaseData {
    actionType: ActionType;
    // Support for multiple actions
    actions?: SingleActionData[];
    // tag_contact fields (legacy - use labelIds for new flows)
    tagOperation?: TagOperation;
    tags?: string[];
    // label_contact fields (new system)
    labelIds?: string[];
    // assign_conversation fields
    attendantId?: string | null;
    attendantName?: string | null;
    // set_variable fields
    variableName?: string;
    variableValue?: string;
    // send_message fields
    content?: string;
    messageType?: MessageType;
    mediaUrl?: string;
    mediaName?: string;
    mediaMimeType?: string;
    // send_template fields
    templateId?: string;
    templateName?: string;
    channelId?: string;
    variableMapping?: Record<
      string,
      {
        source: "auto" | "manual";
        value: string;
      }
    >;
    // transfer fields
    sectorId?: string | null;
    sectorName?: string | null;
    // pause_flow fields
    pauseDuration?: number;
    pauseUnit?: PauseUnit;
    // capture_input fields
    question?: string;
    inputValidationType?: InputValidationType;
    inputOptions?: string[];
    errorMessage?: string;
    maxAttempts?: number;
    saveToContact?: boolean;
    contactField?: InputContactField;
  }

  export interface SubflowData extends BaseData {
    targetFlowId: string | null;
    targetFlowName?: string | null;
    waitForCompletion: boolean;
  }

  export interface RandomData extends BaseData {
    outputs: Array<{
      id: string;
      label: string;
      percentage: number;
    }>;
  }

  export type InputValidationType =
    | "text"
    | "number"
    | "email"
    | "phone"
    | "cpf"
    | "cnpj"
    | "cep"
    | "date"
    | "time"
    | "options";

  export type InputContactField =
    | "name"
    | "email"
    | "phone"
    | "document"
    | "address"
    | "city"
    | "state"
    | "zipCode";

  export interface InputData extends BaseData {
    question: string;
    variableName: string;
    validationType: InputValidationType;
    inputOptions?: string[];
    placeholder?: string;
    errorMessage?: string;
    maxAttempts: number;
    saveToContact?: boolean;
    contactField?: InputContactField;
  }

  export interface EndData extends BaseData {
    closeConversation?: boolean;
  }

  export type Data =
    | BaseData
    | StartData
    | MessageData
    | MenuData
    | IntervalData
    | TransferData
    | TemplateData
    | ConditionalData
    | ActionData
    | SubflowData
    | RandomData
    | InputData
    | EndData;

  export interface Props {
    id: string;
    type: Type;
    position: Position;
    data: Data;
  }

  export interface Raw {
    id: string;
    type: Type;
    position: Position;
    data: Data;
  }

  export interface CreateProps {
    id?: string;
    type: Type;
    position: Position;
    data: Data;
  }
}

export class FlowNode {
  public id: string;
  public type: FlowNode.Type;
  public position: FlowNode.Position;
  public data: FlowNode.Data;

  constructor(props: FlowNode.Props) {
    this.id = props.id;
    this.type = props.type;
    this.position = props.position;
    this.data = props.data;
  }

  updatePosition(position: FlowNode.Position) {
    this.position = position;
    return this;
  }

  updateData(data: FlowNode.Data) {
    this.data = data;
    return this;
  }

  raw(): FlowNode.Raw {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      data: this.data,
    };
  }

  static instance(props: FlowNode.Props) {
    return new FlowNode(props);
  }

  static fromRaw(props: FlowNode.Raw) {
    return new FlowNode({
      id: props.id,
      type: props.type,
      position: props.position,
      data: props.data,
    });
  }

  static create(props: FlowNode.CreateProps) {
    if (!props.type || !props.position) {
      throw InvalidCreation.instance();
    }

    return new FlowNode({
      id: props.id ?? crypto.randomUUID().toString(),
      type: props.type,
      position: props.position,
      data: props.data,
    });
  }
}
