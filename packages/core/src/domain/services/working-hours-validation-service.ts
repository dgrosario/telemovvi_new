import { Sector } from "../entities/sector";
import { User } from "../entities/user";
import { Membership } from "../entities/membership";

export class WorkingHoursValidationService {
  canAccessNow(
    user: User,
    sectors: Sector[],
    membership: Membership,
    currentTime: Date = new Date()
  ): boolean {
    if (membership.hasPermission("access:outside-working-hours")) {
      return true;
    }

    if (sectors.length === 0) {
      return true;
    }

    return sectors.some((sector) => sector.isWithinWorkingHours(currentTime));
  }

  static instance() {
    return new WorkingHoursValidationService();
  }
}
