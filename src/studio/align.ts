// 文件说明：自动补充文件级注释，描述模块职责与用途

// 对齐与分布：生成移动命令
import type { Graph, NodePosition } from "../engine/ir";
import type { Command } from "./commands";

// 对齐模式
export type AlignMode = "left" | "right" | "top" | "bottom" | "centerX" | "centerY";
export type DistributeMode = "horizontal" | "vertical";

// 过滤选中节点
const getNodes = (graph: Graph, nodeIds: string[]) =>
  graph.nodes.filter((node) => nodeIds.includes(node.id));

// 对齐节点并返回移动命令
export const alignNodes = (graph: Graph, nodeIds: string[], mode: AlignMode): Command[] => {
  const nodes = getNodes(graph, nodeIds);
  if (nodes.length < 2) return [];
  const xs = nodes.map((node) => node.pos.x);
  const ys = nodes.map((node) => node.pos.y);
  const targetX =
    mode === "left"
      ? Math.min(...xs)
      : mode === "right"
        ? Math.max(...xs)
        : mode === "centerX"
          ? (Math.min(...xs) + Math.max(...xs)) / 2
          : null;
  const targetY =
    mode === "top"
      ? Math.min(...ys)
      : mode === "bottom"
        ? Math.max(...ys)
        : mode === "centerY"
          ? (Math.min(...ys) + Math.max(...ys)) / 2
          : null;

  return nodes
    .map((node) => {
      const nextPos: NodePosition = {
        x: targetX === null ? node.pos.x : targetX,
        y: targetY === null ? node.pos.y : targetY,
      };
      if (nextPos.x === node.pos.x && nextPos.y === node.pos.y) return null;
      return { type: "MOVE_NODE", nodeId: node.id, pos: nextPos } as const;
    })
    .filter((item): item is Command => Boolean(item));
};

// 均匀分布节点并返回移动命令
export const distributeNodes = (graph: Graph, nodeIds: string[], mode: DistributeMode): Command[] => {
  const nodes = getNodes(graph, nodeIds);
  if (nodes.length < 3) return [];
  const sorted = [...nodes].sort((a, b) =>
    mode === "horizontal" ? a.pos.x - b.pos.x : a.pos.y - b.pos.y
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span =
    mode === "horizontal" ? last.pos.x - first.pos.x : last.pos.y - first.pos.y;
  const step = span / (sorted.length - 1);
  return sorted.map((node, index) => {
    const target =
      mode === "horizontal"
        ? { x: first.pos.x + step * index, y: node.pos.y }
        : { x: node.pos.x, y: first.pos.y + step * index };
    return { type: "MOVE_NODE", nodeId: node.id, pos: target } as const;
  });
};
