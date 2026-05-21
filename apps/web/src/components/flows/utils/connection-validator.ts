import type { Node, Edge } from "reactflow";
import type { FlowNodeType } from "@/stores/flow-editor-store";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConnectionValidationOptions {
  allowSelfLoops?: boolean;
  allowDuplicateConnections?: boolean;
  validateHandles?: boolean;
}

const DEFAULT_OPTIONS: ConnectionValidationOptions = {
  allowSelfLoops: false,
  allowDuplicateConnections: false,
  validateHandles: true,
};

export function validateConnection(
  sourceId: string,
  targetId: string,
  sourceHandle: string | null,
  nodes: Node[],
  edges: Edge[],
  options: ConnectionValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sourceId === targetId && !opts.allowSelfLoops) {
    errors.push("Não é possível conectar um bloco a si mesmo");
  }

  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);

  if (!sourceNode) {
    errors.push(`Bloco de origem não encontrado: ${sourceId}`);
  }

  if (!targetNode) {
    errors.push(`Bloco de destino não encontrado: ${targetId}`);
  }

  if (sourceNode && targetNode && opts.validateHandles) {
    const sourceNodeType = sourceNode.type as FlowNodeType;

    if (sourceHandle) {
      const isValidHandle = validateSourceHandle(
        sourceNodeType,
        sourceHandle,
        sourceNode.data
      );

      if (!isValidHandle) {
        errors.push(
          `Handle inválido: ${sourceHandle} não existe no bloco ${sourceNodeType}`
        );
      }
    }

    if (sourceNodeType === "start" && targetNode.type === "start") {
      errors.push("Não é possível conectar blocos de início");
    }
  }

  if (!opts.allowDuplicateConnections) {
    const normalizedHandle = sourceHandle ?? null;
    const duplicate = edges.find(
      (e) =>
        e.source === sourceId &&
        e.target === targetId &&
        (e.sourceHandle ?? null) === normalizedHandle
    );

    if (duplicate) {
      errors.push("Esta conexão já existe");
    }
  }

  // Validar nodes que só podem ter uma saída
  if (sourceNode) {
    const sourceNodeType = sourceNode.type as FlowNodeType;
    const singleOutputNodes: FlowNodeType[] = [
      "start",
      "message",
      "interval",
      "transfer",
      "template",
      "action",
      "subflow",
      "input",
    ];

    if (singleOutputNodes.includes(sourceNodeType)) {
      // Verificar se já existe uma conexão saindo deste node (sem sourceHandle específico)
      const existingConnection = edges.find(
        (e) => e.source === sourceId && (e.sourceHandle ?? null) === (sourceHandle ?? null)
      );

      if (existingConnection) {
        errors.push(
          `Este bloco já possui uma conexão de saída. Remova a conexão existente antes de criar uma nova.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateFlowStructure(
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startNodes = nodes.filter((n) => n.type === "start");

  if (startNodes.length === 0) {
    errors.push("O fluxo deve ter pelo menos um bloco de início");
  }

  if (startNodes.length > 1) {
    warnings.push("Múltiplos blocos de início detectados");
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const orphanEdges: Edge[] = [];

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source)) {
      orphanEdges.push(edge);
      errors.push(
        `Conexão órfã: origem ${edge.source} não existe mais`
      );
    }

    if (!nodeIds.has(edge.target)) {
      orphanEdges.push(edge);
      errors.push(
        `Conexão órfã: destino ${edge.target} não existe mais`
      );
    }
  });

  nodes.forEach((node) => {
    const nodeType = node.type as FlowNodeType;

    if (nodeType === "conditional") {
      const conditions = node.data?.conditions || [];
      const defaultBranch = node.data?.defaultBranch;

      if (conditions.length === 0 && !defaultBranch) {
        warnings.push(
          `Bloco condicional "${node.data?.label || node.id}" não tem condições configuradas`
        );
      }

      const conditionIds = new Set(
        conditions.map((c: { id: string }) => c.id)
      );
      if (defaultBranch) {
        conditionIds.add(defaultBranch.id);
      }

      edges
        .filter((e) => e.source === node.id)
        .forEach((edge) => {
          if (edge.sourceHandle && !conditionIds.has(edge.sourceHandle)) {
            errors.push(
              `Conexão inválida: handle ${edge.sourceHandle} não existe mais no bloco condicional "${node.data?.label || node.id}"`
            );
          }
        });
    }

    if (nodeType === "menu") {
      const options = node.data?.options || [];
      const errorBranch = node.data?.errorBranch;

      if (options.length === 0) {
        warnings.push(
          `Bloco menu "${node.data?.label || node.id}" não tem opções configuradas`
        );
      }

      const optionIds = new Set(options.map((o: { id: string }) => o.id));
      if (errorBranch?.enabled) {
        optionIds.add("error");
      }

      edges
        .filter((e) => e.source === node.id)
        .forEach((edge) => {
          if (edge.sourceHandle && !optionIds.has(edge.sourceHandle)) {
            errors.push(
              `Conexão inválida: handle ${edge.sourceHandle} não existe mais no bloco menu "${node.data?.label || node.id}"`
            );
          }
        });
    }

    if (nodeType === "random") {
      const outputs = node.data?.outputs || [];

      if (outputs.length === 0) {
        warnings.push(
          `Bloco de randomização "${node.data?.label || node.id}" não tem saídas configuradas`
        );
      }

      const outputIds = new Set(outputs.map((o: { id: string }) => o.id));

      edges
        .filter((e) => e.source === node.id)
        .forEach((edge) => {
          if (edge.sourceHandle && !outputIds.has(edge.sourceHandle)) {
            errors.push(
              `Conexão inválida: handle ${edge.sourceHandle} não existe mais no bloco de randomização "${node.data?.label || node.id}"`
            );
          }
        });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateSourceHandle(
  nodeType: FlowNodeType,
  handleId: string,
  nodeData: Record<string, unknown>
): boolean {
  switch (nodeType) {
    case "conditional": {
      const conditions = (nodeData?.conditions as Array<{ id: string }> | undefined) || [];
      const defaultBranch = nodeData?.defaultBranch as { id: string } | undefined;
      const conditionIds = conditions.map((c) => c.id);
      if (defaultBranch) {
        conditionIds.push(defaultBranch.id);
      }
      return conditionIds.includes(handleId);
    }

    case "menu": {
      const options = (nodeData?.options as Array<{ id: string }> | undefined) || [];
      const errorBranch = nodeData?.errorBranch as { enabled?: boolean } | undefined;
      const optionIds = options.map((o) => o.id);
      if (errorBranch?.enabled) {
        optionIds.push("error");
      }
      return optionIds.includes(handleId);
    }

    case "random": {
      const outputs = (nodeData?.outputs as Array<{ id: string }> | undefined) || [];
      const outputIds = outputs.map((o) => o.id);
      return outputIds.includes(handleId);
    }

    case "start":
    case "message":
    case "interval":
    case "transfer":
    case "template":
    case "action":
    case "subflow":
      return handleId === null || handleId === undefined;

    default:
      return true;
  }
}

export function findOrphanEdges(
  nodes: Node[],
  edges: Edge[]
): Edge[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const orphanEdges: Edge[] = [];

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      orphanEdges.push(edge);
    } else {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode && edge.sourceHandle) {
        const nodeType = sourceNode.type as FlowNodeType;
        const isValid = validateSourceHandle(
          nodeType,
          edge.sourceHandle,
          sourceNode.data
        );

        if (!isValid) {
          orphanEdges.push(edge);
        }
      }
    }
  });

  return orphanEdges;
}

export function cleanupOrphanEdges(
  nodes: Node[],
  edges: Edge[]
): Edge[] {
  const orphanEdges = findOrphanEdges(nodes, edges);
  const orphanEdgeIds = new Set(orphanEdges.map((e) => e.id));
  return edges.filter((e) => !orphanEdgeIds.has(e.id));
}
