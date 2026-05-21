import { InvalidCreation } from "../errors/invalid-creation";
import { Sector } from "./sector";

export namespace User {
  export interface Props {
    id: string;
    name: string;
    email: string;
    thumbnail: string | null;
    sectors: Sector[];
    signatureEnabled: boolean;
    isDeletable: boolean;
    isActive: boolean;
    displayName: string | null;
    phone: string | null;
    birthDate: string | null;
    address: string | null;
  }
  export interface CreateProps {
    name: string;
    email: string;
    isDeletable?: boolean;
    sectorIds?: string[];
    displayName?: string;
    phone?: string;
    birthDate?: string;
    address?: string;
  }

  export interface Raw {
    id: string;
    name: string;
    email: string;
    thumbnail: string | null;
    sectors: Sector.Props[];
    signatureEnabled: boolean;
    isDeletable: boolean;
    isActive: boolean;
    displayName: string | null;
    phone: string | null;
    birthDate: string | null;
    address: string | null;
  }
}

export class User {
  public id: string;
  public name: string;
  public email: string;
  public thumbnail: string | null;
  private _sectors: Sector[];
  public signatureEnabled: boolean;
  public isDeletable: boolean;
  public isActive: boolean;
  public displayName: string | null;
  public phone: string | null;
  public birthDate: string | null;
  public address: string | null;

  constructor(props: User.Props) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.thumbnail = props.thumbnail;
    this._sectors = props.sectors;
    this.signatureEnabled = props.signatureEnabled;
    this.isDeletable = props.isDeletable;
    this.isActive = props.isActive;
    this.displayName = props.displayName;
    this.phone = props.phone;
    this.birthDate = props.birthDate;
    this.address = props.address;
  }

  get sectors(): Sector[] {
    return this._sectors;
  }

  get sectorIds(): string[] {
    return this._sectors.map((s) => s.id);
  }

  setSectors(sectors: Sector[]) {
    this._sectors = sectors;
  }

  addSector(sector: Sector) {
    if (!this.hasSector(sector.id)) {
      this._sectors.push(sector);
    }
  }

  removeSector(sectorId: string) {
    this._sectors = this._sectors.filter((s) => s.id !== sectorId);
  }

  hasSector(sectorId: string): boolean {
    return this._sectors.some((s) => s.id === sectorId);
  }

  update(input: {
    email?: string;
    name?: string;
    displayName?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    address?: string | null;
  }) {
    this.email = input.email ?? this.email;
    this.name = input.name ?? this.name;
    if (input.displayName !== undefined) this.displayName = input.displayName;
    if (input.phone !== undefined) this.phone = input.phone;
    if (input.birthDate !== undefined) this.birthDate = input.birthDate;
    if (input.address !== undefined) this.address = input.address;
  }

  setActive(active: boolean) {
    this.isActive = active;
  }

  raw(): User.Raw {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      thumbnail: this.thumbnail,
      sectors: this._sectors.map((s) => s.raw()),
      signatureEnabled: this.signatureEnabled,
      isDeletable: this.isDeletable,
      isActive: this.isActive,
      displayName: this.displayName,
      phone: this.phone,
      birthDate: this.birthDate,
      address: this.address,
    };
  }

  static instance(props: User.Props) {
    return new User(props);
  }

  static create(props: User.CreateProps) {
    if (!props.name || !props.email) throw InvalidCreation.instance();

    return new User({
      email: props.email,
      id: crypto.randomUUID().toString(),
      name: props.name,
      sectors: [],
      thumbnail: null,
      signatureEnabled: true,
      isDeletable: props?.isDeletable ?? true,
      isActive: true,
      displayName: props.displayName ?? null,
      phone: props.phone ?? null,
      birthDate: props.birthDate ?? null,
      address: props.address ?? null,
    });
  }
}
