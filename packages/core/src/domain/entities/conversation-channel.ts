import { Channel } from "../entities/channel";
import { InvalidCreation } from "../errors/invalid-creation";

export namespace ConversationChannel {
  export interface Props {
    id: string;
    name: string;
    type: Channel.Type;
  }
}

export class ConversationChannel {
  public id: string;
  public name: string;
  public type: Channel.Type;

  constructor(props: ConversationChannel.Props) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
  }

  raw(): ConversationChannel.Props {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
    };
  }

  static instance(props: ConversationChannel.Props) {
    return new ConversationChannel({
      id: props.id,
      name: props.name,
      type: props.type,
    });
  }

  static create(channel: Channel.Props) {
    if (!channel.id || !channel.name || !channel.type)
      throw InvalidCreation.instance();
    return new ConversationChannel(channel);
  }
}
