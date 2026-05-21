"use client";

import { Drawer, Typography, Divider, IconButton } from "@mui/material";
import { useShallow } from "zustand/shallow";
import { useFlowEditorStore } from "@/stores/flow-editor-store";
import { MenuNodeForm } from "./forms/menu-node-form";
import { IntervalNodeForm } from "./forms/interval-node-form";
import { ConditionalNodeForm } from "./forms/conditional-node-form";
import { ActionNodeForm } from "./forms/action-node-form";
import { SubflowNodeForm } from "./forms/subflow-node-form";
import { RandomNodeForm } from "./forms/random-node-form";
import { StartNodeForm } from "./forms/start-node-form";
import { InputNodeForm } from "./forms/input-node-form";
import { EndNodeForm } from "./forms/end-node-form";
import CloseIcon from "@mui/icons-material/Close";

export function NodeSidebar() {
  const selectedNodeId = useFlowEditorStore((s) => s.selectedNodeId);
  const setSelectedNode = useFlowEditorStore((s) => s.setSelectedNode);
  const flowId = useFlowEditorStore((s) => s.flowId);
  const selectedNode = useFlowEditorStore(
    useShallow((s) => {
      if (!s.selectedNodeId) return null;
      return s.nodes.find((n) => n.id === s.selectedNodeId) ?? null;
    })
  );

  const open = Boolean(selectedNodeId);

  const handleClose = () => {
    setSelectedNode(null);
  };

  const getNodeTypeName = () => {
    switch (selectedNode?.type) {
      case "start":
        return "Início";
      case "message":
      case "transfer":
      case "template":
      case "action":
        return "Ação";
      case "menu":
        return "Menu";
      case "interval":
        return "Intervalo";
      case "conditional":
        return "Condicional";
      case "subflow":
        return "Subfluxo";
      case "random":
        return "Randomização";
      case "input":
        return "Entrada";
      case "end":
        return "Finalizar";
      default:
        return "Bloco";
    }
  };

  const getActionTypeFromNodeType = (nodeType: string): string | undefined => {
    switch (nodeType) {
      case "message":
        return "send_message";
      case "template":
        return "send_template";
      case "transfer":
        return "transfer";
      default:
        return undefined;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      variant="persistent"
      sx={{
        width: open ? 500 : 0,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 500,
          boxSizing: "border-box",
        },
      }}
    >
      <main className="min-w-[500px] max-w-[800px] p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <Typography variant="h5" className="font-semibold">
              {getNodeTypeName()}
            </Typography>
          </div>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>

        <Divider className="!mb-6" />

        {selectedNode?.type === "menu" && (
          <MenuNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "interval" && (
          <IntervalNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "conditional" && (
          <ConditionalNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {(selectedNode?.type === "action" ||
          selectedNode?.type === "message" ||
          selectedNode?.type === "template" ||
          selectedNode?.type === "transfer") && (
          <ActionNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={{
              ...selectedNode.data,
              actionType:
                selectedNode.data?.actionType ||
                getActionTypeFromNodeType(selectedNode.type) ||
                "send_message",
            }}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "subflow" && (
          <SubflowNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "random" && (
          <RandomNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "start" && flowId && (
          <StartNodeForm
            key={selectedNode.id}
            flowId={flowId}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "input" && (
          <InputNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}

        {selectedNode?.type === "end" && (
          <EndNodeForm
            key={selectedNode.id}
            nodeId={selectedNode.id}
            initialData={selectedNode.data}
            onClose={handleClose}
          />
        )}
      </main>
    </Drawer>
  );
}
