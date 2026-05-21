import { useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { useFlowEditorStore, FlowNodeType, isFlowNodeType } from "@/stores/flow-editor-store";
import { useUpdateFlow } from "@/hooks/use-flows";

export function useFlowSave() {
  const flowId = useFlowEditorStore((s) => s.flowId);
  const nodes = useFlowEditorStore(useShallow((s) => s.nodes));
  const edges = useFlowEditorStore(useShallow((s) => s.edges));
  const isDirty = useFlowEditorStore((s) => s.isDirty);
  const markAsClean = useFlowEditorStore((s) => s.markAsClean);
  const { mutateAsync: updateFlow, isPending } = useUpdateFlow();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const isDirtyRef = useRef(isDirty);
  const flowIdRef = useRef(flowId);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  isDirtyRef.current = isDirty;
  flowIdRef.current = flowId;

  const getPayload = useCallback(() => {
    const state = useFlowEditorStore.getState();
    const currentFlowId = state.flowId;
    if (!currentFlowId) return null;

    const currentNodes = state.nodes;
    const currentEdges = state.edges;

    const flowNodes = currentNodes
      .filter((node): node is typeof node & { type: FlowNodeType } =>
        node.type !== undefined && isFlowNodeType(node.type)
      )
      .map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));

    const flowConnections = currentEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
    }));

    return {
      flowId: currentFlowId,
      nodes: flowNodes,
      connections: flowConnections,
    };
  }, []);

  const save = useCallback(async () => {
    const payload = getPayload();
    if (!payload) return false;

    try {
      await updateFlow(payload);
      markAsClean();
      return true;
    } catch {
      return false;
    }
  }, [getPayload, updateFlow, markAsClean]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && flowIdRef.current) {
        const payload = getPayload();
        if (payload) {
          navigator.sendBeacon("/api/flows/save", JSON.stringify(payload));
        }
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [getPayload]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && flowIdRef.current) {
        const payload = getPayload();
        if (payload) {
          navigator.sendBeacon("/api/flows/save", JSON.stringify(payload));
        }
      }
    };
  }, [getPayload]);

  return {
    save,
    isSaving: isPending,
    isDirty,
  };
}
