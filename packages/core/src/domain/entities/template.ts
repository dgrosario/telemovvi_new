import { Variable, VariableRaw } from "../value-objects/variable";
import { Channel } from "./channel";

export namespace Template {
  export type Language = "pt_BR" | "en_US";
  export interface Props {
    id: string;
    name: string;
    status: string;
    language: Language;
    category: string;
    text: string;
    channel: Channel;
    variables?: Variable[];
  }

  export interface Raw {
    id: string;
    name: string;
    status: string;
    language: Language;
    category: string;
    text: string;
    channel: Channel.Raw;
    variables?: VariableRaw[];
  }
}

export class Template {
  public id: string;
  public name: string;
  public status: string;
  public language: Template.Language;
  public category: string;
  public text: string;
  public channel: Channel;
  public variables?: Variable[];

  constructor(props: Template.Props) {
    this.id = props.id;
    this.name = props.name;
    this.status = props.status;
    this.language = props.language;
    this.category = props.category;
    this.text = props.text;
    this.channel = props.channel;
    this.variables = props.variables;
  }

  raw(): Template.Raw {
    return {
      id: this.id,
      category: this.category,
      channel: this.channel.raw(),
      language: this.language,
      name: this.name,
      status: this.status,
      text: this.text,
      variables: this.variables?.map((v) => v.raw()),
    };
  }

  static instance(props: Template.Props) {
    return new Template(props);
  }
}
