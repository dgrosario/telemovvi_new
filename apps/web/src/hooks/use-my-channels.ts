"use client";
import { listMyChannels } from "@/app/actions/channels";
import { useQuery } from "@tanstack/react-query";

export const useMyChannels = () => {
  return useQuery({
    queryKey: ["my-channels"],
    queryFn: async () => {
      const [data, error] = await listMyChannels();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
};
