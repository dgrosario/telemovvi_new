import { listSectors } from "@/app/actions/sectors";
import { RouteGuard } from "@/components/route-guard";
import { DialogLinkUser } from "./dialog-link-user";
import { HeaderSectors } from "./header-sectors";
import ModalRegisterSectors from "./modal-register-sectors";
import TableSectors from "./table-sectors";
import { DialogLinkChannel } from "./dialog-link-channel";

export default async function SectorsPage() {
  const [data] = await listSectors();
  const sectors = data ?? [];
  return (
    <RouteGuard permissions={["manage:sectors", "list:sectors"]}>
      <HeaderSectors />
      <TableSectors sectors={sectors} />
      <ModalRegisterSectors />
      <DialogLinkUser />
      <DialogLinkChannel />
    </RouteGuard>
  );
}
