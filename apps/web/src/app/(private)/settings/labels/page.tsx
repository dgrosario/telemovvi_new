import { listLabels } from "@/app/actions/labels";
import { HeaderLabels } from "./header-labels";
import TableLabels from "./table-labels";
import DialogLabel from "./dialog-label";

export default async function LabelsPage() {
  const [labels] = await listLabels();
  return (
    <>
      <HeaderLabels />
      <TableLabels labels={labels ?? []} />
      <DialogLabel />
    </>
  );
}
