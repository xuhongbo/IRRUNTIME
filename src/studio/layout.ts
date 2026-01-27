import type { Graph, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { resolveNodeDefinition } from "../engine/contract";

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

export const autoLayoutGraph = (
  graph: Graph,
  registry: Registry,
  spacingX = 240,
  spacingY = 140
) => {
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
  return commands;
};
