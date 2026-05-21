"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "reactflow";
import { Flow } from "@omnichannel/core/domain/entities/flow";
import { FlowCanvas } from "@/components/flows/flow-canvas";
import { FlowEditorToolbar } from "@/components/flows/flow-editor-toolbar";
import { NodeSidebar } from "@/components/flows/node-sidebar";
import { TestModeDrawer } from "@/components/flows/test-mode";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { useListChannelsForFlow } from "@/hooks/use-flows";
import { Box } from "@mui/material";

interface FlowEditorProps {
  flow: Flow.Raw;
}

export function FlowEditor({ flow }: FlowEditorProps) {
  // Usar selectors individuais para evitar re-renders desnecessarios
  const setNodes = useFlowEditorStore((s) => s.setNodes);
  const setEdges = useFlowEditorStore((s) => s.setEdges);
  const setFlowId = useFlowEditorStore((s) => s.setFlowId);
  const markAsDirty = useFlowEditorStore((s) => s.markAsDirty);
  const reset = useFlowEditorStore((s) => s.reset);

  // Buscar canais vinculados ao fluxo
  const { data: flowChannels } = useListChannelsForFlow(flow.id);

  // Efeito para inicializar/atualizar os dados do fluxo
  useEffect(() => {
    let reactFlowNodes = flow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }));

    // Se o fluxo não tem blocos, adiciona o bloco de início automaticamente
    const isNewFlow = reactFlowNodes.length === 0;
    if (isNewFlow) {
      reactFlowNodes = [
        {
          id: `start-${Date.now()}`,
          type: "start",
          position: { x: 100, y: 200 },
          data: { label: "Início" },
        },
      ];
    }

    const reactFlowEdges = flow.connections.map((conn) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
    }));

    setFlowId(flow.id);
    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);

    // Marca como dirty para salvar o bloco de início automaticamente
    if (isNewFlow) {
      markAsDirty();
    }
  }, [flow, setFlowId, setNodes, setEdges, markAsDirty]);

  // Efeito para atualizar canais no bloco de início quando mudarem
  useEffect(() => {
    if (!flowChannels) return;

    // Usar getState para acessar nodes sem criar dependência
    const { nodes, updateNodeData } = useFlowEditorStore.getState();
    const startNode = nodes.find((n) => n.type === "start");
    if (startNode) {
      // Verificar se os canais realmente mudaram para evitar updates desnecessários
      const currentChannels = startNode.data?.channels;
      const channelsChanged = JSON.stringify(currentChannels) !== JSON.stringify(flowChannels);
      if (channelsChanged) {
        updateNodeData(startNode.id, { channels: flowChannels });
      }
    }
  }, [flowChannels]);

  // Efeito separado para reset apenas no unmount real do componente
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <Box className="h-screen flex flex-col">
      <FlowEditorToolbar flowName={flow.name} flowStatus={flow.status} />
      <Box className="flex-1">
        <ReactFlowProvider>
          <FlowCanvas />
        </ReactFlowProvider>
      </Box>
      <NodeSidebar />
      <TestModeDrawer />
    </Box>
  );
}
