import type { Graph } from "../../engine/ir";
import type { PinDef, Registry } from "../../engine/registry";
import { isAssignable } from "../../engine/validator";
import { resolveNodeDefinition } from "../../engine/contract";

export type ConnectionEndpoint = {
  nodeId: string;
  pinKey: string;
  side: "input" | "output";
};

export type ConnectionDecision = {
  ok: boolean;
  reason?: string;
};

type PinMeta = {
  kind: PinDef["kind"];
  dataType?: PinDef["dataType"];
};

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

export const canConnectEndpoints = (
  graph: Graph,
  registry: Registry,
  from: ConnectionEndpoint,
  to: ConnectionEndpoint
): ConnectionDecision => {
  if (from.side !== "output" || to.side !== "input") {
    return { ok: false, reason: "Connection must be output -> input." };
  }
  const fromMeta = getPinMeta(graph, registry, from);
  const toMeta = getPinMeta(graph, registry, to);
  if (!fromMeta || !toMeta) {
    return { ok: false, reason: "Missing pin metadata." };
  }
  if (fromMeta.kind !== toMeta.kind) {
    return { ok: false, reason: "Pin kinds must match." };
  }
  if (fromMeta.kind === "data" && !isAssignable(fromMeta.dataType, toMeta.dataType)) {
    return { ok: false, reason: "Data types incompatible." };
  }

  const existingEdge = graph.edges.find(
    (edge) =>
      edge.from.nodeId === from.nodeId &&
      edge.from.pinKey === from.pinKey &&
      edge.to.nodeId === to.nodeId &&
      edge.to.pinKey === to.pinKey
  );
  if (existingEdge) {
    return { ok: false, reason: "Connection already exists." };
  }

  const outgoingCount = graph.edges.filter(
    (edge) => edge.from.nodeId === from.nodeId && edge.from.pinKey === from.pinKey
  ).length;
  const incomingCount = graph.edges.filter(
    (edge) => edge.to.nodeId === to.nodeId && edge.to.pinKey === to.pinKey
  ).length;

  if (fromMeta.kind === "exec" && outgoingCount >= 1) {
    return { ok: false, reason: "Exec outputs only allow one connection." };
  }
  if (incomingCount >= 1) {
    return { ok: false, reason: "Inputs only allow one connection." };
  }

  return { ok: true };
};

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
