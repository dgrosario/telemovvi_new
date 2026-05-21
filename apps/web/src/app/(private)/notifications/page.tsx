import { RouteGuard } from "@/components/route-guard";
import { NotificationsList } from "@/components/notifications-list";

export default async function NotificationsPage() {
  return (
    <RouteGuard permissions={["list:notifications"]}>
      <NotificationsList />
    </RouteGuard>
  );
}
