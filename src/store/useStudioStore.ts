import { create } from "zustand";
import type { Graph } from "../engine/ir";
import { sampleGraph } from "../mock/graph";
import { registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";

export type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export type ValidationState = {
  status: ValidationStatus;
  errors: ValidationError[];
};

export type JsonState = {
  draft: string;
  dirty: boolean;
  error: string | null;
};

export type StudioState = {
  graph: Graph;
  lastGoodGraph: Graph;
  selectedNodeId: string | null;
  validation: ValidationState;
  json: JsonState;
  setGraph: (graph: Graph) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setValidation: (validation: ValidationState) => void;
  setJsonDraft: (draft: string) => void;
  applyJson: () => { ok: boolean; error?: string };
  resetJsonDraft: () => void;
};

const migrateGraphTree = (graph: Graph) => {
  const main = registry.migrateGraph(graph);
  if (!graph.subgraphs) {
    return main.graph;
  }
  const subgraphs: Record<string, Graph> = {};
  for (const [key, subgraph] of Object.entries(graph.subgraphs)) {
    subgraphs[key] = registry.migrateGraph(subgraph).graph;
  }
  return { ...main.graph, subgraphs };
};

const initialGraph = migrateGraphTree(sampleGraph);
const initialJson = JSON.stringify(initialGraph, null, 2);

export const useStudioStore = create<StudioState>((set, get) => ({
  graph: initialGraph,
  lastGoodGraph: initialGraph,
  selectedNodeId: initialGraph.entryNodeId,
  validation: { status: "idle", errors: [] },
  json: { draft: initialJson, dirty: false, error: null },
  setGraph: (graph) =>
    set((state) => ({
      graph,
      lastGoodGraph: graph,
      selectedNodeId: state.selectedNodeId ?? graph.entryNodeId,
    })),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setValidation: (validation) => set({ validation }),
  setJsonDraft: (draft) =>
    set((state) => ({
      json: { ...state.json, draft, dirty: true, error: null },
    })),
  applyJson: () => {
    const { json } = get();
    try {
      const parsed = JSON.parse(json.draft) as Graph;
      set({
        graph: parsed,
        lastGoodGraph: parsed,
        selectedNodeId: parsed.entryNodeId,
        json: { draft: JSON.stringify(parsed, null, 2), dirty: false, error: null },
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      set((state) => ({ json: { ...state.json, error: message } }));
      return { ok: false, error: message };
    }
  },
  resetJsonDraft: () => {
    const graph = get().graph;
    set((state) => ({
      json: { ...state.json, draft: JSON.stringify(graph, null, 2), dirty: false, error: null },
    }));
  },
}));
