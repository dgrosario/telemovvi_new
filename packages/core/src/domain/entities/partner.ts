import { PhoneNormalizer } from "../services/phone-normalizer";
import { Metadata, MetadataRaw } from "../value-objects/metadata";
import { PartnerContact } from "./partner-contact";

export namespace Partner {
  export interface Props {
    id: string;
    name: string;
    isNameCustom: boolean;
    birthday: Date | null;
    contacts: PartnerContact[];
    metadata: Metadata[];
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Raw {
    id: string;
    name: string;
    isNameCustom: boolean;
    birthday: string | null;
    contacts: PartnerContact.Raw[];
    metadata: MetadataRaw[];
    createdAt: string;
    updatedAt: string;
  }

  export interface CreateProps {
    name: string;
    birthday?: Date | null;
    contacts?: (Partial<PartnerContact.Props> & { username?: string })[];
    metadata?: MetadataRaw[];
  }
}

export class Partner {
  public id: string;
  public name: string;
  public isNameCustom: boolean;
  public birthday: Date | null;
  public createdAt: Date;
  public updatedAt: Date;
  private _contacts: Map<string, PartnerContact>;
  private _metadata: Map<string, Metadata>;

  constructor(props: Partner.Props) {
    this.id = props.id;
    this.name = props.name;
    this.isNameCustom = props.isNameCustom;
    this.birthday = props.birthday;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.contacts = props.contacts;
    this.metadata = props.metadata;
  }

  setName(name: string) {
    this.name = name;
  }

  setCustomName(name: string) {
    this.name = name;
    this.isNameCustom = true;
  }

  setContacts(contacts: PartnerContact[]) {
    this._contacts = new Map();
    this.contacts = contacts;
  }

  setMetadata(metadata: Metadata[]) {
    this._metadata = new Map();
    this.metadata = metadata;
  }

  addMetadata(metadata: Metadata) {
    this._metadata.set(metadata.label, metadata);
  }

  set metadata(metadatas: Metadata[]) {
    if (!this._metadata) this._metadata = new Map();
    for (const metadata of metadatas) {
      this._metadata.set(metadata.label, metadata);
    }
  }

  get metadata() {
    return Array.from(this._metadata.values());
  }

  set contacts(contacts: PartnerContact[]) {
    if (!this._contacts) this._contacts = new Map();
    for (const contact of contacts) {
      this._contacts.set(contact.id, contact);
    }
  }

  get contacts() {
    return Array.from(this._contacts.values());
  }

  setBirthday(birthday: Date | null) {
    this.birthday = birthday;
  }

  isBirthdayToday(): boolean {
    if (!this.birthday) return false;
    const today = new Date();
    return (
      this.birthday.getDate() === today.getDate() &&
      this.birthday.getMonth() === today.getMonth()
    );
  }

  raw(): Partner.Raw {
    return {
      id: this.id,
      name: this.name,
      isNameCustom: this.isNameCustom,
      birthday: this.birthday?.toISOString().split("T")[0] ?? null,
      contacts: this.contacts.map((c) => c.raw()),
      metadata: this.metadata.map((m) => m.raw()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  markAsUpdated() {
    this.updatedAt = new Date();
  }

  addContact(contact: PartnerContact) {
    this._contacts.set(contact.id, contact);
  }

  retrieveContact(id: string) {
    return this._contacts.get(id);
  }
  retrieveContactByValue(value: string) {
    const target = value.trim();
    if (!target) return null;

    const variants = PhoneNormalizer.getVariants(target);
    return (
      this.contacts.find((contact) => {
        if (
          contact.type === "whatsapp" ||
          contact.type === "evolution" ||
          contact.type === "meta_api"
        ) {
          return variants.includes(contact.value);
        }

        if (contact.type === "instagram") {
          return (
            contact.value.trim().replace(/^@/, "").toLowerCase() ===
            target.replace(/^@/, "").toLowerCase()
          );
        }

        return contact.value.trim() === target;
      }) || null
    );
  }

  static instance(props: Partner.Props) {
    return new Partner(props);
  }

  static create(props: Partner.CreateProps) {
    const now = new Date();
    return new Partner({
      id: crypto.randomUUID().toString(),
      name: props.name || "",
      isNameCustom: false,
      birthday: props.birthday ?? null,
      contacts: (props.contacts || []).map((c) =>
        PartnerContact.create(
          c.type || "whatsapp",
          c.value || "",
          c.thumbnail,
          c.id,
          c.createdAt,
          c.channelId,
          c.username
        )
      ),
      metadata: (props.metadata || []).map((m) =>
        Metadata.create(m.label, m.value)
      ),
      createdAt: now,
      updatedAt: now,
    });
  }
}
