import type { Graph } from "../engine/ir";
import { registry } from "../engine/registry";
import { validateGraph } from "../engine/validator";

export const validateGraphWithRegistry = (graph: Graph) => {
  return validateGraph(graph, registry);
};
