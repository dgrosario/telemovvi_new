import { Flow } from "../entities/flow";
import { FlowConnection } from "../entities/flow-connection";
import { FlowNode } from "../entities/flow-node";

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FlowValidationOptions {
  strict?: boolean;
}

export class FlowValidationService {
  validate(flow: Flow, options: FlowValidationOptions = {}): FlowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { strict = false } = options;

    if (!flow.nodes || flow.nodes.length === 0) {
      errors.push("Flow must have at least one node");
      return { valid: false, errors, warnings };
    }

    const hasStartNode = this.validateStartNode(flow.nodes);
    if (!hasStartNode) {
      errors.push("Flow must have exactly one start node");
    }

    const orphanNodes = this.findOrphanNodes(flow.nodes, flow.connections);
    if (orphanNodes.length > 0) {
      if (strict) {
        errors.push(
          `Found ${orphanNodes.length} orphan nodes: ${orphanNodes.join(", ")}`
        );
      } else {
        warnings.push(
          `Found ${orphanNodes.length} disconnected nodes: ${orphanNodes.join(", ")}`
        );
      }
    }

    const invalidConnections = this.validateConnections(
      flow.nodes,
      flow.connections
    );
    if (invalidConnections.length > 0) {
      errors.push(
        `Found ${invalidConnections.length} invalid connections referring to non-existent nodes`
      );
    }

    const hasCycles = this.detectCycles(flow.nodes, flow.connections);
    if (hasCycles) {
      errors.push("Flow contains infinite cycles that could cause endless loops");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateStartNode(nodes: FlowNode[]): boolean {
    const startNodes = nodes.filter((node) => node.type === "start");
    return startNodes.length === 1;
  }

  private findOrphanNodes(
    nodes: FlowNode[],
    connections: FlowConnection[]
  ): string[] {
    const orphans: string[] = [];
    const connectedNodeIds = new Set<string>();

    connections.forEach((conn) => {
      connectedNodeIds.add(conn.source);
      connectedNodeIds.add(conn.target);
    });

    nodes.forEach((node) => {
      if (node.type !== "start" && !connectedNodeIds.has(node.id)) {
        orphans.push(node.id);
      }
    });

    return orphans;
  }

  private validateConnections(
    nodes: FlowNode[],
    connections: FlowConnection[]
  ): string[] {
    const invalid: string[] = [];
    const nodeIds = new Set(nodes.map((node) => node.id));

    connections.forEach((conn) => {
      if (!nodeIds.has(conn.source) || !nodeIds.has(conn.target)) {
        invalid.push(conn.id);
      }
    });

    return invalid;
  }

  private detectCycles(
    nodes: FlowNode[],
    connections: FlowConnection[]
  ): boolean {
    const graph = new Map<string, string[]>();

    nodes.forEach((node) => {
      graph.set(node.id, []);
    });

    connections.forEach((conn) => {
      const targets = graph.get(conn.source);
      if (targets) {
        targets.push(conn.target);
      }
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) {
              return true;
            }
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }
      }
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.keys()) {
      if (hasCycle(nodeId)) {
        return true;
      }
    }

    return false;
  }

  static instance() {
    return new FlowValidationService();
  }
}
