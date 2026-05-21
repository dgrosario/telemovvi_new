import { listAllSystemVariables } from "@/app/actions/system-variables";
import { HeaderVariables } from "./header-variables";
import TableVariables from "./table-variables";
import DialogVariable from "./dialog-variable";

export default async function VariablesPage() {
  const [variables] = await listAllSystemVariables();
  return (
    <>
      <HeaderVariables />
      <TableVariables variables={variables ?? []} />
      <DialogVariable />
    </>
  );
}
