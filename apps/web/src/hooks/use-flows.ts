import { useQueryClient } from "@tanstack/react-query";
import {
  associateFlowWithChannels,
  associateFlowWithSectors,
  createFlow,
  deleteFlow,
  duplicateFlow,
  executeFlow,
  retrieveFlow,
  listChannelsForFlow,
  listSectorsForFlow,
  listFlows,
  updateFlow,
} from "../app/actions/flows";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "./server-action-hooks";

export function useListFlows() {
  return useServerActionQuery(listFlows, {
    input: undefined,
    queryKey: ["flows"],
  });
}

export function useGetFlow(flowId: string) {
  return useServerActionQuery(retrieveFlow, {
    input: { flowId },
    queryKey: ["flows", flowId],
    enabled: Boolean(flowId),
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();

  return useServerActionMutation(createFlow, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();

  return useServerActionMutation(updateFlow, {
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      queryClient.invalidateQueries({ queryKey: ["flows", variables.flowId] });
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useServerActionMutation(deleteFlow, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useDuplicateFlow() {
  const queryClient = useQueryClient();

  return useServerActionMutation(duplicateFlow, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useExecuteFlow() {
  return useServerActionMutation(executeFlow);
}

export function useListChannelsForFlow(flowId: string) {
  return useServerActionQuery(listChannelsForFlow, {
    input: { flowId },
    queryKey: ["flow-channels", flowId],
    enabled: Boolean(flowId),
  });
}

export function useAssociateFlowWithChannels() {
  const queryClient = useQueryClient();

  return useServerActionMutation(associateFlowWithChannels, {
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      queryClient.invalidateQueries({ queryKey: ["flows", variables.flowId] });
      queryClient.invalidateQueries({
        queryKey: ["flow-channels", variables.flowId],
      });
    },
  });
}

export function useListSectorsForFlow(flowId: string) {
  return useServerActionQuery(listSectorsForFlow, {
    input: { flowId },
    queryKey: ["flow-sectors", flowId],
    enabled: Boolean(flowId),
  });
}

export function useAssociateFlowWithSectors() {
  const queryClient = useQueryClient();

  return useServerActionMutation(associateFlowWithSectors, {
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      queryClient.invalidateQueries({ queryKey: ["flows", variables.flowId] });
      queryClient.invalidateQueries({
        queryKey: ["flow-sectors", variables.flowId],
      });
    },
  });
}
