import type { Graph } from "../engine/ir";
import type { Command } from "./commands";

export type LintIssue = {
  id: string;
  nodeId?: string;
  message: string;
  severity: "info" | "warning";
  fix?: { label: string; commands: Command[] };
};

export const lintGraph = (graph: Graph): LintIssue[] => {
  const issues: LintIssue[] = [];
  const edgesByNode = new Map<string, { inExec: number; outExec: number }>();
  for (const node of graph.nodes) {
    edgesByNode.set(node.id, { inExec: 0, outExec: 0 });
  }
  for (const edge of graph.edges) {
    const from = edgesByNode.get(edge.from.nodeId);
    const to = edgesByNode.get(edge.to.nodeId);
    if (from) from.outExec += 1;
    if (to) to.inExec += 1;
  }
  for (const node of graph.nodes) {
    const stats = edgesByNode.get(node.id);
    if (!stats) continue;
    if (node.type !== "Start" && stats.inExec === 0) {
      issues.push({
        id: `no-in-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        message: "Node has no incoming exec connection.",
      });
    }
    if (node.type !== "End" && stats.outExec === 0) {
      issues.push({
        id: `no-out-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        message: "Node has no outgoing exec connection.",
      });
    }
    if (stats.inExec === 0 && stats.outExec === 0 && node.type !== "Start" && node.type !== "End") {
      issues.push({
        id: `isolated-${node.id}`,
        nodeId: node.id,
        severity: "info",
        message: "Node is isolated.",
        fix: {
          label: "Remove node",
          commands: [{ type: "DELETE_NODE", nodeId: node.id }],
        },
      });
    }
  }
  return issues;
};
