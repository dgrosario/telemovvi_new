import { listGeneralTemplates } from "@/app/actions/templates";
import TableTemplatesGeneral from "./table-templates-general";
import HeaderGeneralTemplates from "./header-general-templates";
import DialogGeneralTemplate from "./dialog-general-template";
export default async function TemplatesPage() {
  const [templates] = await listGeneralTemplates();

  return (
    <>
      <HeaderGeneralTemplates />
      <TableTemplatesGeneral templates={templates || []} />
      <DialogGeneralTemplate />
    </>
  );
}
