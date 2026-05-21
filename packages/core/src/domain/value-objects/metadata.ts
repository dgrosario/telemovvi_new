export type MetadataRaw = {
  label: string;
  value: string;
};

export class Metadata {
  constructor(
    readonly label: string,
    readonly value: string
  ) {}
  raw() {
    return {
      label: this.label,
      value: this.value,
    };
  }
  static create(label: string, value: string) {
    return new Metadata(label || "", value || "");
  }
}
