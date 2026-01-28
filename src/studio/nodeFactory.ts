import type { Graph, NodeInstance, NodePosition } from "../engine/ir";
import type { NodeDefinition, Registry } from "../engine/registry";

export const makeNodeId = (type: string, seed: number) => {
  return `${type.toLowerCase()}-${seed}`;
};

export const createNodeInstance = (
  type: string,
  registry: Registry,
  pos: NodePosition,
  seed: number = Date.now()
): NodeInstance => {
  const def = registry.getLatest(type);
  if (!def) {
    throw new Error(`Unknown node type: ${type}`);
  }
  return {
    id: makeNodeId(type, seed),
    type,
    version: def.version,
    props: { ...def.defaultProps },
    pos,
  };
};

export const listPaletteItems = (registry: Registry) => {
  return registry
    .listTypes()
    .map((type) => registry.getLatest(type))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
    .map((def) => ({
      type: def.type,
      version: def.version,
      title: def.title,
      description: def.description,
    }));
};

export type NodeCategory =
  | "入口"
  | "流程"
  | "逻辑"
  | "变量"
  | "脚本"
  | "交互"
  | "时间"
  | "子图"
  | "常量"
  | "转换"
  | "其它";

export const getNodeCategory = (type: string): NodeCategory => {
  if (type === "Start" || type === "End") return "入口";
  if (type === "If" || type === "Equals") return "逻辑";
  if (type === "SetVar" || type === "GetVar") return "变量";
  if (type === "Script" || type === "Expression") return "脚本";
  if (type === "ShowText" || type === "WaitForChoice") return "交互";
  if (type === "Delay") return "时间";
  if (type === "Subgraph") return "子图";
  if (type.startsWith("Const")) return "常量";
  if (type.startsWith("To")) return "转换";
  if (type === "GraphInput" || type === "GraphOutput") return "流程";
  return "其它";
};

export const isFlowDefinition = (def: NodeDefinition) =>
  def.inputs.some((pin) => pin.kind === "exec") || def.outputs.some((pin) => pin.kind === "exec");

export const isDataDefinition = (def: NodeDefinition) => !isFlowDefinition(def);

export const listFlowPaletteItems = (registry: Registry) => {
  return registry
    .listTypes()
    .map((type) => registry.getLatest(type))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
    .filter((def) => isFlowDefinition(def))
    .map((def) => ({
      type: def.type,
      version: def.version,
      title: def.title,
      description: def.description,
      category: getNodeCategory(def.type),
    }));
};

export const listDataPaletteItems = (registry: Registry) => {
  return registry
    .listTypes()
    .map((type) => registry.getLatest(type))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
    .filter((def) => isDataDefinition(def))
    .map((def) => ({
      type: def.type,
      version: def.version,
      title: def.title,
      description: def.description,
      category: getNodeCategory(def.type),
    }));
};

export const listFlowTypes = (registry: Registry) =>
  registry
    .listTypes()
    .map((type) => registry.getLatest(type))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
    .filter((def) => isFlowDefinition(def))
    .map((def) => def.type);
