// 文件说明：自动补充文件级注释，描述模块职责与用途

// 轻量提示规则：非阻断的设计建议
import type { Graph } from "../engine/ir";
import { isNamespaced } from "../engine/vars";
import { registry } from "../engine/registry";
import { resolveNodeDefinition } from "../engine/contract";
import type { Command } from "./commands";

// 提示信息结构
export type LintIssue = {
  id: string;
  nodeId?: string;
  message: string;
  severity: "info" | "warning";
  fix?: { label: string; commands: Command[] };
};

// 扫描图并生成提示
export const lintGraph = (graph: Graph): LintIssue[] => {
  const issues: LintIssue[] = [];
  const edgesByNode = new Map<string, { inExec: number; outExec: number }>();
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
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
    const resolved = resolveNodeDefinition(node, graph, registry);
    const hasExecPins = resolved
      ? resolved.inputs.some((pin) => pin.kind === "exec") ||
        resolved.outputs.some((pin) => pin.kind === "exec")
      : true;
    if (!hasExecPins) {
      continue;
    }
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

  for (const node of graph.nodes) {
    if (node.type !== "SetVar" && node.type !== "GetVar") continue;
    const nameEdge = graph.edges.find(
      (edge) => edge.to.nodeId === node.id && edge.to.pinKey === "name"
    );
    if (!nameEdge) continue;
    const source = nodesById.get(nameEdge.from.nodeId);
    if (!source || source.type !== "ConstString") continue;
    const value = String(source.props?.value ?? "");
    if (value && !isNamespaced(value)) {
      issues.push({
        id: `var-namespace-${node.id}`,
        nodeId: node.id,
        severity: "info",
        message: "变量名建议使用命名空间，例如 global.xxx。",
      });
    }
  }

  return issues;
};
