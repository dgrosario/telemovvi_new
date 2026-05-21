import { InvalidCreation } from "../errors/invalid-creation";

export interface WorkingHoursProps {
  start: string;
  end: string;
}

export class WorkingHours {
  constructor(
    readonly start: string,
    readonly end: string
  ) {}

  raw(): WorkingHoursProps {
    return {
      start: this.start,
      end: this.end,
    };
  }

  isWithinHours(date: Date): boolean {
    const timeString = date.toTimeString().slice(0, 8);
    return timeString >= this.start && timeString <= this.end;
  }

  get formatted(): string {
    return `${this.start.slice(0, 5)} - ${this.end.slice(0, 5)}`;
  }

  validate() {
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;

    if (!timeRegex.test(this.start)) {
      throw InvalidCreation.instance("Invalid start time format. Expected HH:MM:SS");
    }

    if (!timeRegex.test(this.end)) {
      throw InvalidCreation.instance("Invalid end time format. Expected HH:MM:SS");
    }

    if (this.start >= this.end) {
      throw InvalidCreation.instance("Start time must be before end time");
    }
  }

  static create(start: string, end: string): WorkingHours {
    const instance = new WorkingHours(start, end);
    instance.validate();
    return instance;
  }

  static default(): WorkingHours {
    return new WorkingHours("08:00:00", "19:00:00");
  }

  static instance(props: WorkingHoursProps): WorkingHours {
    return new WorkingHours(props.start, props.end);
  }
}
