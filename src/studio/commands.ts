// 文件说明：自动补充文件级注释，描述模块职责与用途

// 图编辑命令：用于描述可序列化的编辑操作
import type { Graph, NodePosition } from "../engine/ir";

// 命令联合类型
export type Command =
  | { type: "ADD_NODE"; node: Graph["nodes"][number] }
  | { type: "DELETE_NODE"; nodeId: string }
  | { type: "MOVE_NODE"; nodeId: string; pos: NodePosition }
  | { type: "SET_PROP"; nodeId: string; props: Record<string, unknown> }
  | { type: "SET_CONTRACT"; contract: Graph["contract"] }
  | { type: "SET_PRESETS"; presets: Graph["presets"] }
  | { type: "CONNECT"; edge: Graph["edges"][number] }
  | { type: "DISCONNECT"; edgeId: string }
  | { type: "APPLY_JSON"; graph: Graph };

// 应用命令到图结构
export const applyCommand = (graph: Graph, command: Command): Graph => {
  switch (command.type) {
    case "ADD_NODE":
      return { ...graph, nodes: [...graph.nodes, command.node] };
    case "DELETE_NODE":
      return {
        ...graph,
        nodes: graph.nodes.filter((node) => node.id !== command.nodeId),
        edges: graph.edges.filter(
          (edge) => edge.from.nodeId !== command.nodeId && edge.to.nodeId !== command.nodeId
        ),
      };
    case "MOVE_NODE":
      return {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === command.nodeId ? { ...node, pos: command.pos } : node
        ),
      };
    case "SET_PROP":
      return {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === command.nodeId ? { ...node, props: command.props } : node
        ),
      };
    case "SET_CONTRACT":
      return {
        ...graph,
        contract: command.contract,
      };
    case "SET_PRESETS":
      return {
        ...graph,
        presets: command.presets,
      };
    case "CONNECT":
      return { ...graph, edges: [...graph.edges, command.edge] };
    case "DISCONNECT":
      return { ...graph, edges: graph.edges.filter((edge) => edge.id !== command.edgeId) };
    case "APPLY_JSON":
      return command.graph;
    default: {
      const _exhaustive: never = command;
      return graph;
    }
  }
};
