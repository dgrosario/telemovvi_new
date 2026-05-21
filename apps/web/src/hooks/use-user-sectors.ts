"use client";
import { listCurrentUserSectors } from "@/app/actions/sectors";
import { useQuery } from "@tanstack/react-query";

export const useUserSectors = () => {
  return useQuery({
    queryKey: ["user-sectors"],
    queryFn: async () => {
      const [data, error] = await listCurrentUserSectors();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
};
