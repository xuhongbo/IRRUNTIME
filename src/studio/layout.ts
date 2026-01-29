// 文件说明：自动补充文件级注释，描述模块职责与用途

// 自动布局与图中心计算
import type { Graph, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { resolveNodeDefinition } from "../engine/contract";
import type { Command } from "./commands";

// 计算图中心点（用于居中视图）
export const getGraphCenter = (graph: Graph): NodePosition => {
  if (graph.nodes.length === 0) {
    return { x: 0, y: 0 };
  }
  let minX = graph.nodes[0].pos.x;
  let maxX = graph.nodes[0].pos.x;
  let minY = graph.nodes[0].pos.y;
  let maxY = graph.nodes[0].pos.y;
  for (const node of graph.nodes) {
    minX = Math.min(minX, node.pos.x);
    maxX = Math.max(maxX, node.pos.x);
    minY = Math.min(minY, node.pos.y);
    maxY = Math.max(maxY, node.pos.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

// 简易布局：按执行深度分层排列
const autoLayoutGraphSimple = (
  graph: Graph,
  registry: Registry,
  spacingX: number,
  spacingY: number
): Command[] => {
  const execEdges = graph.edges.filter((edge) => {
    const sourceNode = graph.nodes.find((node) => node.id === edge.from.nodeId);
    if (!sourceNode) return false;
    const resolved = resolveNodeDefinition(sourceNode, graph, registry);
    if (!resolved) return false;
    const pin = resolved.outputs.find((output) => output.key === edge.from.pinKey);
    return pin?.kind === "exec";
  });
  const edges = execEdges.length > 0 ? execEdges : graph.edges;
  const depth = new Map<string, number>();
  const queue: string[] = [graph.entryNodeId];
  depth.set(graph.entryNodeId, 0);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDepth = depth.get(current) ?? 0;
    for (const edge of edges) {
      if (edge.from.nodeId !== current) continue;
      if (!depth.has(edge.to.nodeId)) {
        depth.set(edge.to.nodeId, currentDepth + 1);
        queue.push(edge.to.nodeId);
      }
    }
  }
  const groups = new Map<number, Graph["nodes"][number][]>();
  for (const node of graph.nodes) {
    const d = depth.get(node.id) ?? 0;
    const list = groups.get(d) ?? [];
    list.push(node);
    groups.set(d, list);
  }
  const commands = [];
  for (const [d, nodes] of groups.entries()) {
    nodes.sort((a, b) => a.id.localeCompare(b.id));
    nodes.forEach((node, index) => {
      const pos = { x: d * spacingX, y: index * spacingY };
      commands.push({ type: "MOVE_NODE", nodeId: node.id, pos } as const);
    });
  }
  return commands as Command[];
};

// 估算节点尺寸，用于布局引擎
const estimateNodeSize = (node: Graph["nodes"][number], registry: Registry, graph: Graph) => {
  const resolved = resolveNodeDefinition(node, graph, registry);
  const inputCount = resolved?.inputs.length ?? 0;
  const outputCount = resolved?.outputs.length ?? 0;
  const rows = Math.max(inputCount, outputCount, 1);
  const title = resolved?.def.title ?? node.type;
  const inputLabelLen = Math.max(0, ...(resolved?.inputs.map((pin) => pin.label.length) ?? [0]));
  const outputLabelLen = Math.max(0, ...(resolved?.outputs.map((pin) => pin.label.length) ?? [0]));
  const maxLabelLen = Math.max(title.length, inputLabelLen, outputLabelLen);
  const width = Math.min(360, Math.max(220, 160 + maxLabelLen * 8));
  const height = 72 + rows * 28;
  return { width, height };
};

// 转换为布局引擎节点格式
const toElkNodes = (graph: Graph, registry: Registry) =>
  graph.nodes.map((node) => {
    const { width, height } = estimateNodeSize(node, registry, graph);
    return { id: node.id, width, height };
  });

// 转换为布局引擎边格式（优先执行边）
const toElkEdges = (graph: Graph, registry: Registry) => {
  const execEdges = graph.edges.filter((edge) => {
    const sourceNode = graph.nodes.find((node) => node.id === edge.from.nodeId);
    if (!sourceNode) return false;
    const resolved = resolveNodeDefinition(sourceNode, graph, registry);
    if (!resolved) return false;
    const pin = resolved.outputs.find((output) => output.key === edge.from.pinKey);
    return pin?.kind === "exec";
  });
  const edges = execEdges.length > 0 ? execEdges : graph.edges;
  return edges.map((edge) => ({
    id: edge.id,
    sources: [edge.from.nodeId],
    targets: [edge.to.nodeId],
  }));
};

// 自动布局：优先使用 ELK，引擎不可用时回退
export const autoLayoutGraph = async (
  graph: Graph,
  registry: Registry,
  spacingX = 240,
  spacingY = 140,
  options?: { engine?: "elk" | "simple" }
): Promise<Command[]> => {
  if (graph.nodes.length === 0) return [];
  const engine = options?.engine ?? "elk";
  if (engine === "simple") {
    return autoLayoutGraphSimple(graph, registry, spacingX, spacingY);
  }

  try {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const elk = new ELK();
    const elkGraph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.cycleBreaking.strategy": "GREEDY",
        "elk.layered.spacing.nodeNodeBetweenLayers": String(spacingX),
        "elk.layered.spacing.edgeNodeBetweenLayers": "40",
        "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
        "elk.spacing.nodeNode": String(spacingY),
        "elk.spacing.edgeNode": "30",
        "elk.spacing.edgeEdge": "20",
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      },
      children: toElkNodes(graph, registry),
      edges: toElkEdges(graph, registry),
    };
    const layout = await elk.layout(elkGraph);
    const commands: Command[] = [];
    for (const node of layout.children ?? []) {
      const x = typeof node.x === "number" ? node.x : 0;
      const y = typeof node.y === "number" ? node.y : 0;
      commands.push({ type: "MOVE_NODE", nodeId: node.id, pos: { x, y } });
    }
    return commands;
  } catch {
    return autoLayoutGraphSimple(graph, registry, spacingX, spacingY);
  }
};
