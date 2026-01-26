import type { Graph } from "../engine/ir";
import type { Registry, PinDef } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import { resolveNodeDefinition } from "../engine/contract";

export type PinStatus = {
  key: string;
  label: string;
  kind: PinDef["kind"];
  dataType?: PinDef["dataType"];
  required?: boolean;
  connected: boolean;
  connections: number;
  errors: string[];
};

export type NodePinStatus = {
  inputs: PinStatus[];
  outputs: PinStatus[];
};

export type NodeErrorGroups = {
  nodeErrors: ValidationError[];
  pinErrors: Map<string, string[]>;
};

export const groupNodeErrors = (
  errors: ValidationError[],
  nodeId: string
): NodeErrorGroups => {
  const nodeErrors: ValidationError[] = [];
  const pinErrors = new Map<string, string[]>();
  for (const err of errors) {
    if (err.nodeId !== nodeId) continue;
    if (err.pinKey) {
      const bucket = pinErrors.get(err.pinKey) ?? [];
      bucket.push(err.message);
      pinErrors.set(err.pinKey, bucket);
    } else {
      nodeErrors.push(err);
    }
  }
  return { nodeErrors, pinErrors };
};

export const getNodePinStatus = (
  graph: Graph,
  nodeId: string,
  registry: Registry,
  pinErrors: Map<string, string[]>
): NodePinStatus | null => {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const resolved = resolveNodeDefinition(node, graph, registry);
  if (!resolved) return null;

  const inputCounts = new Map<string, number>();
  const outputCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.to.nodeId === nodeId) {
      inputCounts.set(edge.to.pinKey, (inputCounts.get(edge.to.pinKey) ?? 0) + 1);
    }
    if (edge.from.nodeId === nodeId) {
      outputCounts.set(edge.from.pinKey, (outputCounts.get(edge.from.pinKey) ?? 0) + 1);
    }
  }

  const buildStatus = (pin: PinDef, counts: Map<string, number>): PinStatus => {
    const connections = counts.get(pin.key) ?? 0;
    return {
      key: pin.key,
      label: pin.label,
      kind: pin.kind,
      dataType: pin.dataType,
      required: pin.required,
      connected: connections > 0,
      connections,
      errors: pinErrors.get(pin.key) ?? [],
    };
  };

  return {
    inputs: resolved.inputs.map((pin) => buildStatus(pin, inputCounts)),
    outputs: resolved.outputs.map((pin) => buildStatus(pin, outputCounts)),
  };
};
