import { TitlePage } from "@/components/title-page";
import { Paper, Typography } from "@mui/material";
import { listFlows } from "@/app/actions/flows";
import { FlowsTable } from "./flows-table";
import { CreateFlowButton } from "./create-flow-button";
import { FlowDetailsDrawer } from "./flow-details-drawer";

export default async function FlowsPage() {
  const [flows] = await listFlows();

  return (
    <>
      <header className="pt-6 flex justify-between items-center px-6">
        <TitlePage>Gerenciamento de fluxos de atendimento</TitlePage>
        <CreateFlowButton />
      </header>
      <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
        <Typography variant="h5" className="px-6 py-5">
          Automatize seus atendimentos
        </Typography>
        <Typography variant="body1" className="px-6 pb-5" color="secondary">
          Fluxos automatizados permitem criar fluxos de atendimento com menus,
          mensagens, intervalos e transferências para setores. Configure seus
          fluxos e melhore a eficiência do seu atendimento.
        </Typography>
        <FlowsTable flows={flows || []} />
      </Paper>
      <FlowDetailsDrawer />
    </>
  );
}
