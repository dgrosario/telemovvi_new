import { listMyChannels } from "@/app/actions/channels";
import { listPartners } from "@/app/actions/partners";
import { RouteGuard } from "@/components/route-guard";
import { loadPartnersFilters } from "@/hooks/partners-filters-loader";
import { redirect } from "next/navigation";
import { HeaderClients } from "./header-clients";
import { FiltersClients } from "./filters-clients";
import TableClients from "./table-clients";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: any) {
  const { page, channelFilters, query } = await loadPartnersFilters.parse(
    searchParams,
    {
      strict: true,
    }
  );

  const [channelsData] = await listMyChannels();
  const channels = channelsData ?? [];

  if (channelFilters.length === 0 && channels.length > 0) {
    const allIds = channels.map((c) => c.id).join(",");
    redirect(`/clients?channelFilters=${allIds}`);
  }

  const [data] = await listPartners({
    pageIndex: page,
    channelFilters,
    query,
  });

  return (
    <RouteGuard permissions={["manage:partners"]}>
      <div className="h-full overflow-y-auto">
        <HeaderClients />
        <FiltersClients channels={channels} />
        <TableClients
          clients={data?.results ?? []}
          totalPages={data?.totalPages ?? 0}
          channels={channels}
        />
      </div>
    </RouteGuard>
  );
}
