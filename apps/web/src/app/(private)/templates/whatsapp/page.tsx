import { RouteGuard } from "@/components/route-guard";
import { TitlePage } from "@/components/title-page";
import { Paper, Typography } from "@mui/material";
import DialogWhatsappTemplate from "./dialog-whatsapp-template";
import { listTemplates } from "@/app/actions/templates";
import { TableTemplates } from "./table-templates";

export default async function TemplatesPage() {
  const [templates] = await listTemplates();

  return (
    <RouteGuard permissions={["manage:templates", "list:templates"]}>
      <header className="pt-6 flex justify-between items-center px-6">
        <TitlePage>Modelos do WhatsApp</TitlePage>
      </header>
      <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
        <Typography variant="h5" className="px-6 py-5">
          Crie seu primeiro modelo
        </Typography>
        <Typography variant="body1" className="px-6" color="secondary">
          Modelos são mensagens pré-escritas para executar campanhas de
          marketing, simplificar o suporte ao cliente, iniciar conversas e muito
          mais. Você pode enviá-los manualmente, adicioná-los a transmissões ou
          automatizá-los por meio de bots.
        </Typography>
        <div
          data-hidden={templates?.length! > 0}
          className="w-full grid gap-10 justify-center px-6 py-5"
        >
          <DialogWhatsappTemplate />
        </div>
        <TableTemplates templates={templates || []} />
      </Paper>
    </RouteGuard>
  );
}
