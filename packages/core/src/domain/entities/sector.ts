import { InvalidCreation } from "../errors/invalid-creation";
import { WorkingHours } from "../value-objects/working-hours";

export namespace Sector {
  export interface Props {
    id: string;
    name: string;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    color?: string;
    isDefault?: boolean;
  }
}

function generateRandomColor(): string {
  const colors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#14B8A6", // teal
    "#F97316", // orange
  ];
  return colors[Math.floor(Math.random() * colors.length)]!;
}

export class Sector {
  public id: string;
  public name: string;
  private _workingHours: WorkingHours;
  public color: string;
  public isDefault: boolean;

  constructor(props: Sector.Props) {
    this.id = props.id;
    this.name = props.name;
    this._workingHours =
      props.workingHoursStart && props.workingHoursEnd
        ? WorkingHours.instance({
            start: props.workingHoursStart,
            end: props.workingHoursEnd,
          })
        : WorkingHours.default();
    this.color = props.color ?? generateRandomColor();
    this.isDefault = props.isDefault ?? false;
  }

  get workingHours(): WorkingHours {
    return this._workingHours;
  }

  setWorkingHours(workingHours: WorkingHours): void {
    this._workingHours = workingHours;
  }

  setAsDefault(): void {
    this.isDefault = true;
  }

  unsetAsDefault(): void {
    this.isDefault = false;
  }

  isWithinWorkingHours(date: Date = new Date()): boolean {
    return this._workingHours.isWithinHours(date);
  }

  raw() {
    return {
      id: this.id,
      name: this.name,
      workingHoursStart: this._workingHours.start,
      workingHoursEnd: this._workingHours.end,
      color: this.color,
      isDefault: this.isDefault,
    };
  }

  static instance(props: Sector.Props) {
    return new Sector(props);
  }

  static create(name: string) {
    if (!name) throw InvalidCreation.instance();
    return new Sector({
      id: crypto.randomUUID().toString(),
      name,
    });
  }
}
