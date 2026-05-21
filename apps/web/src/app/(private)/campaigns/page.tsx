import { listCampaigns } from "@/app/actions/campaigns";
import { TitlePage } from "@/components/title-page";
import { Button, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import { CampaignsTable } from "./campaigns-table";

export default async function CampaignsPage() {
  const [result] = await listCampaigns({});

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-6 flex justify-between items-center px-6">
        <TitlePage>Campanhas de Mensagens</TitlePage>
        <Link href="/campaigns/create">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
          >
            Nova Campanha
          </Button>
        </Link>
      </header>
      <Paper elevation={0} className="m-6 border rounded overflow-x-auto">
        <Typography variant="h5" className="px-6 py-5">
          Envio em massa de mensagens
        </Typography>
        <Typography variant="body1" className="px-6 pb-5" color="secondary">
          Crie campanhas para enviar mensagens personalizadas para seus clientes.
          Filtre por tags, crie variações de mensagem (teste A/B) e agende o envio.
        </Typography>
        <CampaignsTable campaigns={result?.campaigns ?? []} />
      </Paper>
    </div>
  );
}
