import type { Graph, NodePosition } from "../engine/ir";

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
