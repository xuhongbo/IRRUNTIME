import type { Graph } from "../engine/ir";

export type ClipboardPayload = {
  nodes: Graph["nodes"][number][];
  edges: Graph["edges"][number][];
};

export const copySelection = (graph: Graph, nodeIds: string[]): ClipboardPayload | null => {
  if (nodeIds.length === 0) return null;
  const nodeSet = new Set(nodeIds);
  const nodes = graph.nodes.filter((node) => nodeSet.has(node.id));
  const edges = graph.edges.filter(
    (edge) => nodeSet.has(edge.from.nodeId) && nodeSet.has(edge.to.nodeId)
  );
  return { nodes, edges };
};

export const pasteSelection = (
  payload: ClipboardPayload,
  offset: { x: number; y: number }
): { nodes: Graph["nodes"][number][]; edges: Graph["edges"][number][] } => {
  const idMap = new Map<string, string>();
  const nodes = payload.nodes.map((node, index) => {
    const id = `${node.id}-${Date.now()}-${index}`;
    idMap.set(node.id, id);
    return {
      ...node,
      id,
      pos: { x: node.pos.x + offset.x, y: node.pos.y + offset.y },
    };
  });
  const edges = payload.edges.map((edge, index) => {
    const fromId = idMap.get(edge.from.nodeId) ?? edge.from.nodeId;
    const toId = idMap.get(edge.to.nodeId) ?? edge.to.nodeId;
    return {
      ...edge,
      id: `${edge.id}-${Date.now()}-${index}`,
      from: { ...edge.from, nodeId: fromId },
      to: { ...edge.to, nodeId: toId },
    };
  });
  return { nodes, edges };
};

export const getSelectionBounds = (nodes: Graph["nodes"][number][]) => {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = nodes[0].pos.x;
  let minY = nodes[0].pos.y;
  let maxX = nodes[0].pos.x;
  let maxY = nodes[0].pos.y;
  for (const node of nodes) {
    minX = Math.min(minX, node.pos.x);
    minY = Math.min(minY, node.pos.y);
    maxX = Math.max(maxX, node.pos.x);
    maxY = Math.max(maxY, node.pos.y);
  }
  return { minX, minY, maxX, maxY };
};
