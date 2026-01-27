import type { Graph, GraphContract, GraphContractPort } from "./ir";
import type { NodeDefinition, PinDef, Registry } from "./registry";

export type ContractKind = "inputs" | "outputs";

export const normalizeContract = (contract?: GraphContract): GraphContract => ({
  inputs: (contract?.inputs ?? []).map((item) => ({
    ...item,
    required: item.required ?? false,
  })),
  outputs: (contract?.outputs ?? []).map((item) => ({
    ...item,
    required: item.required ?? true,
  })),
});

export const findContractPort = (
  graph: Graph,
  kind: ContractKind,
  name: string
): GraphContractPort | null => {
  const contract = normalizeContract(graph.contract);
  const list = kind === "inputs" ? contract.inputs : contract.outputs;
  return list.find((item) => item.name === name) ?? null;
};

export const buildGraphInputPins = (graph: Graph, name: string): PinDef[] => {
  const port = findContractPort(graph, "inputs", name);
  const label = name ? `输入 ${name}` : "输入";
  return [
    {
      key: "value",
      label,
      kind: "data",
      dataType: port?.type ?? "json",
      required: port?.required ?? true,
      defaultValue: port?.defaultValue,
    },
  ];
};

export const buildGraphOutputPins = (graph: Graph, name: string): PinDef[] => {
  const port = findContractPort(graph, "outputs", name);
  const label = name ? `输出 ${name}` : "输出";
  return [
    {
      key: "in",
      label: "执行",
      kind: "exec",
    },
    {
      key: "value",
      label,
      kind: "data",
      dataType: port?.type ?? "json",
      required: port?.required ?? true,
    },
  ];
};

export const resolveNodeDefinition = (
  node: Graph["nodes"][number],
  graph: Graph,
  registry: Registry
): { def: NodeDefinition; inputs: PinDef[]; outputs: PinDef[] } | null => {
  const def = registry.get(node.type, node.version) ?? registry.getLatest(node.type);
  if (!def) return null;
  if (node.type === "GraphInput") {
    const name = typeof node.props.name === "string" ? node.props.name : "";
    return { def, inputs: [], outputs: buildGraphInputPins(graph, name) };
  }
  if (node.type === "GraphOutput") {
    const name = typeof node.props.name === "string" ? node.props.name : "";
    return { def, inputs: buildGraphOutputPins(graph, name), outputs: def.outputs };
  }
  return { def, inputs: def.inputs, outputs: def.outputs };
};

export const listContractNames = (contract: GraphContract): { inputs: string[]; outputs: string[] } => ({
  inputs: contract.inputs.map((item) => item.name),
  outputs: contract.outputs.map((item) => item.name),
});

export const hasDuplicateNames = (names: string[]) => {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) return true;
    seen.add(name);
  }
  return false;
};
