import { listQuickMessages } from "@/app/actions/quick-messages";
import { RouteGuard } from "@/components/route-guard";
import TableQuickMessages from "./table-quick-messages";
import HeaderQuickMessages from "./header-quick-messages";
import DialogQuickMessage from "./dialog-quick-message";

export default async function QuickMessagesPage() {
  const [messages] = await listQuickMessages();

  return (
    <RouteGuard permissions={["view:quick-messages"]}>
      <HeaderQuickMessages />
      <TableQuickMessages messages={messages || []} />
      <DialogQuickMessage />
    </RouteGuard>
  );
}
