import { InvalidCreation } from "../errors/invalid-creation";
import { Channel } from "./channel";
import { Partner } from "./partner";

export namespace Contact {
  export interface Props {
    id: string;
    name: string;
    thumbnail: string;
    value: string;
    username: string;
    type: Channel.Type;
  }

  export interface Raw {
    id: string;
    name: string;
    thumbnail: string;
    value: string;
    username: string;
    type: Channel.Type;
    acronym: string;
  }
}

export class Contact {
  public readonly senderType: "contact" = "contact";
  public id: string;
  public name: string;
  public thumbnail: string;
  public value: string;
  public username: string;
  public type: Channel.Type;

  constructor(props: Contact.Props) {
    this.id = props.id;
    this.name = props.name;
    this.thumbnail = props.thumbnail;
    this.value = props.value;
    this.username = props.username;
    this.type = props.type;
  }

  get acronym() {
    return this.name
      .split(" ")
      .map((w) => w[0])
      .join("");
  }

  raw(): Contact.Raw {
    return {
      id: this.id,
      name: this.name,
      thumbnail: this.thumbnail,
      type: this.type,
      value: this.value,
      username: this.username,
      acronym: this.acronym,
    };
  }

  static instance(props: Contact.Props) {
    return new Contact(props);
  }

  static fromPartner(partner: Partner, partnerContactId: string) {
    const contact = partner.retrieveContact(partnerContactId);
    if (!contact) throw InvalidCreation.instance();
    return new Contact({
      id: contact.id,
      name: partner.name,
      thumbnail: contact.thumbnail,
      type: contact.type,
      value: contact.value,
      username: contact.username,
    });
  }

  static create(
    type: Channel.Type,
    value: string,
    name?: string,
    thumbnail?: string,
    username?: string
  ) {
    if (!value || !type) throw InvalidCreation.instance();
    return new Contact({
      id: crypto.randomUUID().toString(),
      name: name || "",
      thumbnail: thumbnail || "",
      type,
      value,
      username: username || "",
    });
  }
}
