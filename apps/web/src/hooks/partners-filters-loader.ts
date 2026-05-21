import { useQueryStates } from "nuqs";
import * as server from "nuqs/server";
import * as client from "nuqs";

export const partnersFilters = {
  page: server.parseAsInteger.withDefault(0),
  channelFilters: server.parseAsArrayOf(server.parseAsString).withDefault([]),
  query: server.parseAsString.withDefault(""),
};

export const loadPartnersFilters =
  server.createSearchParamsCache(partnersFilters);

export const usePartnersFilters = () => {
  const [filters, setFilters] = useQueryStates({
    page: client.parseAsInteger.withDefault(0).withOptions({ shallow: false }),
    channelFilters: client
      .parseAsArrayOf(client.parseAsString)
      .withDefault([])
      .withOptions({ shallow: false }),
    query: client.parseAsString.withDefault("").withOptions({ shallow: true }),
  });

  return {
    page: filters.page,
    channelFilters: filters.channelFilters,
    query: filters.query,
    setPage: (page: number) => setFilters({ page }),
    setChannelFilters: (channelFilters: string[]) =>
      setFilters({ channelFilters, page: 0 }),
    setQuery: (query: string) => setFilters({ query, page: 0 }),
    clearFilters: () => setFilters({ channelFilters: [], query: "", page: 0 }),
  };
};
