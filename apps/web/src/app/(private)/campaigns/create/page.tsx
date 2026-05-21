import { listChannels } from "@/app/actions/channels";
import { TitlePage } from "@/components/title-page";
import { Paper } from "@mui/material";
import { CreateCampaignForm } from "./create-campaign-form";

export default async function CreateCampaignPage() {
  const [channelsResult] = await listChannels({});

  const channels = (channelsResult ?? [])
    .filter((c) => c.status === "connected")
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-6 px-6">
        <TitlePage>Nova Campanha</TitlePage>
      </header>
      <Paper elevation={0} className="m-6 border rounded p-6">
        <CreateCampaignForm channels={channels} />
      </Paper>
    </div>
  );
}
