import { getCampaign } from "@/app/actions/campaigns";
import { TitlePage } from "@/components/title-page";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignActions } from "./campaign-actions";
import { MessageVariationCard } from "./message-variation-card";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

const statusConfig: Record<
  string,
  { label: string; color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" }
> = {
  draft: { label: "Rascunho", color: "default" },
  scheduled: { label: "Agendada", color: "info" },
  running: { label: "Em execução", color: "warning" },
  completed: { label: "Concluída", color: "success" },
  cancelled: { label: "Cancelada", color: "error" },
  failed: { label: "Falhou", color: "error" },
};

export default async function CampaignDetailsPage({ params }: PageProps) {
  const { campaignId } = await params;
  const [campaign, error] = await getCampaign({ campaignId });

  if (error || !campaign) {
    notFound();
  }

  const { label, color } = statusConfig[campaign.status] ?? statusConfig.draft;

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-6 px-6 flex items-center gap-4">
        <Link href="/campaigns">
          <Button
            startIcon={<ArrowBackIcon />}
            variant="text"
          >
            Voltar
          </Button>
        </Link>
        <TitlePage>{campaign.name}</TitlePage>
        <Chip label={label} color={color} size="small" />
      </header>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Paper elevation={0} className="border rounded p-6 lg:col-span-2">
          <Typography variant="h6" className="mb-4">
            Progresso do Envio
          </Typography>

          <Box className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>
                {campaign.progress.sent} de {campaign.progress.total} enviadas
              </span>
              <span>{campaign.progress.percentage}%</span>
            </div>
            <LinearProgress
              variant="determinate"
              value={campaign.progress.percentage}
              color={campaign.progress.failed > 0 ? "warning" : "success"}
              className="h-3 rounded"
            />
          </Box>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total"
              value={campaign.progress.total}
              color="text-gray-700"
            />
            <StatCard
              label="Enviadas"
              value={campaign.progress.sent}
              color="text-green-600"
            />
            <StatCard
              label="Pendentes"
              value={campaign.progress.pending}
              color="text-blue-600"
            />
            <StatCard
              label="Falhas"
              value={campaign.progress.failed}
              color="text-red-600"
            />
          </div>

          <Typography variant="h6" className="mb-4">
            Variações de Mensagem
          </Typography>

          <div className="space-y-4">
            {campaign.messages.map((message) => (
              <MessageVariationCard key={message.id} message={message} />
            ))}
          </div>
        </Paper>

        <div className="space-y-6">
          <Paper elevation={0} className="border rounded p-6">
            <Typography variant="h6" className="mb-4">
              Informações
            </Typography>

            <div className="space-y-3 text-sm">
              <InfoRow label="Canal" value={campaign.channelName} />
              <InfoRow
                label="Criada em"
                value={format(new Date(campaign.createdAt), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}
              />
              {campaign.scheduledAt && (
                <InfoRow
                  label="Agendada para"
                  value={format(
                    new Date(campaign.scheduledAt),
                    "dd/MM/yyyy HH:mm",
                    { locale: ptBR }
                  )}
                />
              )}
              {campaign.startedAt && (
                <InfoRow
                  label="Iniciada em"
                  value={format(
                    new Date(campaign.startedAt),
                    "dd/MM/yyyy HH:mm",
                    { locale: ptBR }
                  )}
                />
              )}
              {campaign.completedAt && (
                <InfoRow
                  label="Finalizada em"
                  value={format(
                    new Date(campaign.completedAt),
                    "dd/MM/yyyy HH:mm",
                    { locale: ptBR }
                  )}
                />
              )}
            </div>
          </Paper>

          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded p-4 text-center">
      <Typography variant="body2" className="text-gray-500 mb-1">
        {label}
      </Typography>
      <Typography variant="h5" className={`font-bold ${color}`}>
        {value}
      </Typography>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
