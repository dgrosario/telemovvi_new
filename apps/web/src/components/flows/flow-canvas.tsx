"use client";

import { useCallback, useMemo, useRef } from "react";
import ReactFlow, {
  Controls,
  ConnectionMode,
  Panel,
  Node,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { useShallow } from "zustand/shallow";
import { toast } from "react-toastify";
import { useFlowEditorStore, isFlowNodeType } from "@/stores/flow-editor-store";
import { StartNode } from "./nodes/start-node";
import { MessageNode } from "./nodes/message-node";
import { MenuNode } from "./nodes/menu-node";
import { IntervalNode } from "./nodes/interval-node";
import { TransferNode } from "./nodes/transfer-node";
import { TemplateNode } from "./nodes/template-node";
import { ConditionalNode } from "./nodes/conditional-node";
import { ActionNode } from "./nodes/action-node";
import { SubflowNode } from "./nodes/subflow-node";
import { RandomNode } from "./nodes/random-node";
import { InputNode } from "./nodes/input-node";
import { EndNode } from "./nodes/end-node";
import { CustomEdge } from "./edges";
import { NodePalette } from "./node-palette";
import { NodeTypeMenu } from "./node-type-menu";
import type { FlowNodeType } from "@/stores/flow-editor-store";
import { validateConnection } from "./utils/connection-validator";

const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  menu: MenuNode,
  interval: IntervalNode,
  transfer: TransferNode,
  template: TemplateNode,
  conditional: ConditionalNode,
  action: ActionNode,
  subflow: SubflowNode,
  random: RandomNode,
  input: InputNode,
  end: EndNode,
};

const edgeTypes = {
  default: CustomEdge,
};

export function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow();

  // Usar selectors individuais para evitar re-renders desnecessarios
  const nodes = useFlowEditorStore(useShallow((s) => s.nodes));
  const edges = useFlowEditorStore(useShallow((s) => s.edges));
  const testHighlightedNodeId = useFlowEditorStore((s) => s.testHighlightedNodeId);
  const connectionMenuState = useFlowEditorStore((s) => s.connectionMenuState);

  // Funcoes do store - referencias estaveis
  const onNodesChange = useFlowEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowEditorStore((s) => s.onEdgesChange);
  const addNode = useFlowEditorStore((s) => s.addNode);
  const setSelectedNode = useFlowEditorStore((s) => s.setSelectedNode);
  const setConnectionMenuState = useFlowEditorStore((s) => s.setConnectionMenuState);
  const clearConnectionMenuState = useFlowEditorStore((s) => s.clearConnectionMenuState);

  const connectionStartRef = useRef<{
    nodeId: string | null;
    handleId: string | null;
    startX: number;
    startY: number;
  } | null>(null);

  // Flag para indicar se uma conexão foi realizada com sucesso
  const connectionSuccessRef = useRef(false);

  // Distância mínima em pixels para considerar como arraste
  const MIN_DRAG_DISTANCE = 10;

  const nodesWithHighlight = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        highlighted: node.id === testHighlightedNodeId,
      },
    }));
  }, [nodes, testHighlightedNodeId]);

  const isValidConnection = useCallback(
    (connection: {
      source: string | null;
      target: string | null;
      sourceHandle?: string | null;
    }) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceHandle = connection.sourceHandle ?? null;
      const isDuplicate = edges.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          (e.sourceHandle ?? null) === sourceHandle
      );

      if (isDuplicate) return false;

      return true;
    },
    [edges]
  );

  const onConnect = useCallback(
    (connection: {
      source: string | null;
      target: string | null;
      sourceHandle: string | null;
    }) => {
      if (!connection.source || !connection.target) return;

      const state = useFlowEditorStore.getState();
      const validation = validateConnection(
        connection.source,
        connection.target,
        connection.sourceHandle,
        state.nodes,
        state.edges
      );

      if (!validation.valid) {
        console.warn("Conexão inválida:", validation.errors);
        return;
      }

      // Marca que a conexão foi bem-sucedida
      connectionSuccessRef.current = true;

      const newEdge = {
        id: `e${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
      };

      useFlowEditorStore.setState((state) => ({
        edges: [...state.edges, newEdge],
        isDirty: true,
      }));
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !isFlowNodeType(type)) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [addNode, screenToFlowPosition]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onConnectStart = useCallback(
    (
      event: React.MouseEvent | React.TouchEvent,
      params: { nodeId: string | null; handleId: string | null }
    ) => {
      // Captura a posição inicial do mouse/touch
      const { clientX, clientY } =
        "touches" in event ? event.touches[0] : event;

      // Reseta a flag de conexão bem-sucedida
      connectionSuccessRef.current = false;

      connectionStartRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        startX: clientX,
        startY: clientY,
      };
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const startParams = connectionStartRef.current;

      if (!startParams) return;

      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;

      // Aguardar um tick para dar tempo do onConnect ser processado
      setTimeout(() => {
        // Se a conexão foi bem-sucedida (ligou em outro nó), não abre o menu
        if (connectionSuccessRef.current) {
          connectionStartRef.current = null;
          return;
        }

      // Calcula a distância percorrida
      const deltaX = clientX - startParams.startX;
      const deltaY = clientY - startParams.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Só abre o menu se foi um arraste real (distância >= 10px)
      // Clique simples na bolinha não abre o menu
      if (distance >= MIN_DRAG_DISTANCE) {
        // Validar antes de abrir menu
        const sourceNode = nodes.find((n) => n.id === startParams.nodeId);
        if (!sourceNode) {
          connectionStartRef.current = null;
          return;
        }

        // Verificar se origem já tem conexão (single-output)
        const singleOutputNodes = [
          "start",
          "message",
          "interval",
          "transfer",
          "template",
          "action",
          "subflow",
          "input",
        ];
        const isSingleOutput = singleOutputNodes.includes(sourceNode.type || "");

        if (isSingleOutput) {
          const hasExistingConnection = edges.some(
            (e) =>
              e.source === startParams.nodeId &&
              (e.sourceHandle ?? null) === (startParams.handleId ?? null)
          );

          if (hasExistingConnection) {
            toast.error("Não é possível conectar. Bloco de origem já possui conexão.");
            connectionStartRef.current = null;
            return;
          }
        }


        // Abrir menu
        setConnectionMenuState({
          position: { x: clientX, y: clientY },
          sourceNodeId: startParams.nodeId,
          sourceHandleId: startParams.handleId,
        });
      }

      connectionStartRef.current = null;
      }, 0);
    },
    [nodes, edges, screenToFlowPosition, setConnectionMenuState]
  );

  const handleNodeTypeSelect = useCallback(
    (nodeType: FlowNodeType) => {
      const menuState = useFlowEditorStore.getState().connectionMenuState;
      if (!menuState) return;

      const { position, sourceNodeId, sourceHandleId } = menuState;

      const flowPosition = screenToFlowPosition({
        x: position.x,
        y: position.y,
      });

      const adjustedPosition = {
        x: flowPosition.x + 140,
        y: flowPosition.y - 30,
      };

      const newNodeId = `${nodeType}-${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        position: adjustedPosition,
        data: {
          label: getDefaultLabel(nodeType),
        },
      };

      useFlowEditorStore.setState((state) => ({
        nodes: [...state.nodes, newNode],
        isDirty: true,
      }));

      if (sourceNodeId) {
        const state = useFlowEditorStore.getState();
        const validation = validateConnection(
          sourceNodeId,
          newNodeId,
          sourceHandleId,
          [...state.nodes, newNode],
          state.edges
        );

        if (validation.valid) {
          const newEdge = {
            id: `e${sourceNodeId}-${newNodeId}`,
            source: sourceNodeId,
            target: newNodeId,
            sourceHandle: sourceHandleId,
          };

          useFlowEditorStore.setState((state) => ({
            edges: [...state.edges, newEdge],
          }));
        } else {
          console.warn("Conexão inválida:", validation.errors);
        }
      }

      clearConnectionMenuState();
      setSelectedNode(newNodeId);
    },
    [screenToFlowPosition, clearConnectionMenuState, setSelectedNode]
  );

  return (
    <>
      <ReactFlow
        nodes={nodesWithHighlight}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={isValidConnection}
        fitView
        minZoom={0.1}
        maxZoom={2}
        className="bg-gray-50"
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "default",
        }}
      >
        <Controls />
        <Panel position="top-left">
          <NodePalette />
        </Panel>
      </ReactFlow>
      <NodeTypeMenu
        position={connectionMenuState?.position || null}
        onSelectType={handleNodeTypeSelect}
        onClose={clearConnectionMenuState}
      />
    </>
  );
}

function getDefaultLabel(type: FlowNodeType): string {
  switch (type) {
    case "start":
      return "Início";
    case "message":
      return "Mensagem";
    case "menu":
      return "Menu";
    case "interval":
      return "Intervalo";
    case "transfer":
      return "Transferir";
    case "template":
      return "Template";
    case "conditional":
      return "Condicional";
    case "action":
      return "Ação";
    case "subflow":
      return "Subfluxo";
    case "random":
      return "Randomização";
    case "input":
      return "Entrada";
    case "end":
      return "Finalizar";
    default:
      return "";
  }
}
