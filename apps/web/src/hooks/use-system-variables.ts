import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";
import {
  createSystemVariable,
  deleteSystemVariable,
  listAllSystemVariables,
  listSystemVariables,
  retrieveSystemVariable,
  updateSystemVariable,
} from "../app/actions/system-variables";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "./server-action-hooks";

type DialogStore = {
  open: boolean;
  setOpen(open: boolean): void;
  id: string;
  setId(id: string): void;
  toggleOpen(): void;
};

export const useSystemVariablesDialog = create<DialogStore>((set, get) => ({
  open: false,
  setOpen(open: boolean) {
    set({ open });
  },
  id: "",
  setId(id: string) {
    set({ id });
  },
  toggleOpen() {
    set({ open: !get().open });
  },
}));

export function useListSystemVariables() {
  return useServerActionQuery(listSystemVariables, {
    input: undefined,
    queryKey: ["system-variables"],
  });
}

export function useListAllSystemVariables() {
  return useServerActionQuery(listAllSystemVariables, {
    input: undefined,
    queryKey: ["system-variables", "all"],
  });
}

export function useGetSystemVariable(id: string) {
  return useServerActionQuery(retrieveSystemVariable, {
    input: { id },
    queryKey: ["system-variables", id],
    enabled: Boolean(id),
  });
}

export function useCreateSystemVariable() {
  const queryClient = useQueryClient();

  return useServerActionMutation(createSystemVariable, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-variables"] });
    },
  });
}

export function useUpdateSystemVariable() {
  const queryClient = useQueryClient();

  return useServerActionMutation(updateSystemVariable, {
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["system-variables"] });
      queryClient.invalidateQueries({
        queryKey: ["system-variables", variables.id],
      });
    },
  });
}

export function useDeleteSystemVariable() {
  const queryClient = useQueryClient();

  return useServerActionMutation(deleteSystemVariable, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-variables"] });
    },
  });
}

export function useSystemVariablesMap() {
  const { data: variables } = useListSystemVariables();

  const variableMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of variables ?? []) {
      map.set(`{{${v.key}}}`, v.label);
    }
    return map;
  }, [variables]);

  return {
    variables: variables ?? [],
    variableMap,
  };
}
