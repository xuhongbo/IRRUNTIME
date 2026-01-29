// 文件说明：自动补充文件级注释，描述模块职责与用途

// 连接规则：用于画布层判断连线是否合法
import type { Graph } from "../../engine/ir";
import type { PinDef, Registry } from "../../engine/registry";
import { isAssignable } from "../../engine/validator";
import { resolveNodeDefinition } from "../../engine/contract";

// 连线端点描述
export type ConnectionEndpoint = {
  nodeId: string;
  pinKey: string;
  side: "input" | "output";
};

// 连接判断结果
export type ConnectionDecision = {
  ok: boolean;
  reason?: string;
};

// 端口元信息：仅保留校验所需字段
type PinMeta = {
  kind: PinDef["kind"];
  dataType?: PinDef["dataType"];
};

// 获取端口元信息，用于连接校验
const getPinMeta = (graph: Graph, registry: Registry, endpoint: ConnectionEndpoint): PinMeta | null => {
  const node = graph.nodes.find((item) => item.id === endpoint.nodeId);
  if (!node) return null;
  const resolved = resolveNodeDefinition(node, graph, registry);
  if (!resolved) return null;
  if (endpoint.side === "output") {
    const pin = resolved.outputs.find((item) => item.key === endpoint.pinKey);
    return pin ? { kind: pin.kind, dataType: pin.dataType } : null;
  }
  const pin = resolved.inputs.find((item) => item.key === endpoint.pinKey);
  return pin ? { kind: pin.kind, dataType: pin.dataType } : null;
};

// 判断两个端点是否可以连线
export const canConnectEndpoints = (
  graph: Graph,
  registry: Registry,
  from: ConnectionEndpoint,
  to: ConnectionEndpoint
): ConnectionDecision => {
  if (from.side !== "output" || to.side !== "input") {
    return { ok: false, reason: "连接必须从输出指向输入。" };
  }
  const fromMeta = getPinMeta(graph, registry, from);
  const toMeta = getPinMeta(graph, registry, to);
  if (!fromMeta || !toMeta) {
    return { ok: false, reason: "缺少端口元信息。" };
  }
  if (fromMeta.kind !== toMeta.kind) {
    return { ok: false, reason: "端口类型不匹配。" };
  }
  if (fromMeta.kind === "data" && !isAssignable(fromMeta.dataType, toMeta.dataType)) {
    return { ok: false, reason: "数据类型不兼容。" };
  }

  const existingEdge = graph.edges.find(
    (edge) =>
      edge.from.nodeId === from.nodeId &&
      edge.from.pinKey === from.pinKey &&
      edge.to.nodeId === to.nodeId &&
      edge.to.pinKey === to.pinKey
  );
  if (existingEdge) {
    return { ok: false, reason: "连接已存在。" };
  }

  const outgoingCount = graph.edges.filter(
    (edge) => edge.from.nodeId === from.nodeId && edge.from.pinKey === from.pinKey
  ).length;
  const incomingCount = graph.edges.filter(
    (edge) => edge.to.nodeId === to.nodeId && edge.to.pinKey === to.pinKey
  ).length;

  if (fromMeta.kind === "exec" && outgoingCount >= 1) {
    return { ok: false, reason: "执行输出只允许一个连接。" };
  }
  if (incomingCount >= 1) {
    return { ok: false, reason: "输入端口只允许一个连接。" };
  }

  return { ok: true };
};

// 将画布连接对象转换为图边结构
export const connectionToEdge = (connection: {
  id: string;
  source: string;
  sourceOutput: string;
  target: string;
  targetInput: string;
}) => {
  return {
    id: connection.id,
    from: { nodeId: connection.source, pinKey: connection.sourceOutput },
    to: { nodeId: connection.target, pinKey: connection.targetInput },
  };
};
