import { InvalidCreation } from "../errors/invalid-creation";

export const LABEL_PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
  "#06B6D4", // cyan
  "#A855F7", // purple
] as const;

export namespace Label {
  export interface Props {
    id: string;
    name: string;
    color: string;
    workspaceId: string;
    createdAt?: Date;
    updatedAt?: Date;
  }

  export interface Raw {
    id: string;
    name: string;
    color: string;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface CreateProps {
    name: string;
    color?: string;
    workspaceId: string;
  }
}

const MAX_NAME_LENGTH = 100;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function generateRandomColor(): string {
  return LABEL_PRESET_COLORS[Math.floor(Math.random() * LABEL_PRESET_COLORS.length)]!;
}

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    InvalidCreation.instance("Label name is required");
  }
  if (name.length > MAX_NAME_LENGTH) {
    InvalidCreation.instance(`Label name must be at most ${MAX_NAME_LENGTH} characters`);
  }
}

function validateColor(color: string): void {
  if (!HEX_COLOR_REGEX.test(color)) {
    InvalidCreation.instance("Label color must be a valid hex color (e.g., #FF5733)");
  }
}

export class Label {
  public id: string;
  public name: string;
  public color: string;
  public workspaceId: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: Label.Props) {
    this.id = props.id;
    this.name = props.name;
    this.color = props.color;
    this.workspaceId = props.workspaceId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  setName(name: string): void {
    validateName(name);
    this.name = name.trim();
    this.updatedAt = new Date();
  }

  setColor(color: string): void {
    validateColor(color);
    this.color = color;
    this.updatedAt = new Date();
  }

  raw(): Label.Raw {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      workspaceId: this.workspaceId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static instance(props: Label.Props): Label {
    return new Label(props);
  }

  static create(props: Label.CreateProps): Label {
    if (!props.workspaceId) InvalidCreation.instance("Workspace ID is required");

    validateName(props.name);
    const color = props.color ?? generateRandomColor();
    validateColor(color);

    return new Label({
      id: crypto.randomUUID().toString(),
      name: props.name.trim(),
      color,
      workspaceId: props.workspaceId,
    });
  }
}
