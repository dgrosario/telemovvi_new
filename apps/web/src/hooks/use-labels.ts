import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import {
  listLabels,
  retrieveLabel,
  upsertLabel,
  removeLabel,
  removeLabels,
} from "../app/actions/labels";
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

export const useLabelsDialog = create<DialogStore>((set, get) => ({
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

export function useListLabels() {
  return useServerActionQuery(listLabels, {
    input: undefined,
    queryKey: ["labels"],
  });
}

export function useGetLabel(id: string) {
  return useServerActionQuery(retrieveLabel, {
    input: { id },
    queryKey: ["labels", id],
    enabled: Boolean(id),
  });
}

export function useUpsertLabel() {
  const queryClient = useQueryClient();

  return useServerActionMutation(upsertLabel, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });
}

export function useRemoveLabel() {
  const queryClient = useQueryClient();

  return useServerActionMutation(removeLabel, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });
}

export function useRemoveLabels() {
  const queryClient = useQueryClient();

  return useServerActionMutation(removeLabels, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });
}
