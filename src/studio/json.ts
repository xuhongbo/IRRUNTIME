import type { Graph } from "../engine/ir";

export type JsonParseResult =
  | { ok: true; graph: Graph }
  | { ok: false; error: string };

export const parseGraphJson = (draft: string): JsonParseResult => {
  try {
    const parsed = JSON.parse(draft) as Graph;
    return { ok: true, graph: parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
};

export const stringifyGraph = (graph: Graph) => JSON.stringify(graph, null, 2);
