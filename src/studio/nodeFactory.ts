import type { Graph, NodeInstance, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";

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
