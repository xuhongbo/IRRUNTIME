import { assign, createMachine, fromPromise } from "xstate";
import type { Graph } from "../engine/ir";
import { registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import { parseGraphJson, stringifyGraph } from "./json";
import { validateGraphWithRegistry } from "./validation";
import { sampleGraph } from "../engine/sampleGraph";

export type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export type StudioContext = {
  graph: Graph;
  lastGoodGraph: Graph;
  jsonDraft: string;
  jsonError: string | null;
  jsonDirty: boolean;
  validationStatus: ValidationStatus;
  validationErrors: ValidationError[];
  selectedNodeId: string | null;
  focusedPin: { nodeId: string; pinKey: string } | null;
};

export type StudioEvent =
  | { type: "JSON_EDIT"; draft: string }
  | { type: "SYNC_JSON"; draft: string }
  | { type: "APPLY_JSON" }
  | { type: "GRAPH_UPDATED"; graph: Graph }
  | { type: "SELECT_NODE"; nodeId: string | null }
  | { type: "FOCUS_PIN"; nodeId: string; pinKey: string };

export const migrateGraphTree = (graph: Graph) => {
  const main = registry.migrateGraph(graph).graph;
  if (!graph.subgraphs) return main;
  const subgraphs: Record<string, Graph> = {};
  for (const [key, subgraph] of Object.entries(graph.subgraphs)) {
    subgraphs[key] = registry.migrateGraph(subgraph).graph;
  }
  return { ...main, subgraphs };
};

const initialGraph = migrateGraphTree(sampleGraph);

export const studioMachine = createMachine<StudioContext, StudioEvent>(
  {
    id: "studio",
    initial: "editing",
    context: {
      graph: initialGraph,
      lastGoodGraph: initialGraph,
      jsonDraft: stringifyGraph(initialGraph),
      jsonError: null,
      jsonDirty: false,
      validationStatus: "idle",
      validationErrors: [],
      selectedNodeId: initialGraph.entryNodeId,
      focusedPin: null,
    },
    states: {
      editing: {
        on: {
          JSON_EDIT: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => true,
            }),
          },
          SYNC_JSON: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => false,
            }),
          },
          APPLY_JSON: "applyingJson",
          GRAPH_UPDATED: {
            target: "validatingDebounce",
            actions: assign({
              graph: ({ event }) => (event as { graph: Graph }).graph,
              lastGoodGraph: ({ event }) => (event as { graph: Graph }).graph,
              jsonDraft: ({ context, event }) =>
                context.jsonDirty ? context.jsonDraft : stringifyGraph((event as { graph: Graph }).graph),
            }),
          },
          SELECT_NODE: {
            actions: assign({
              selectedNodeId: ({ event }) => (event as { nodeId: string | null }).nodeId,
              focusedPin: () => null,
            }),
          },
          FOCUS_PIN: {
            actions: assign({
              selectedNodeId: ({ event }) => (event as { nodeId: string }).nodeId,
              focusedPin: ({ event }) => ({
                nodeId: (event as { nodeId: string }).nodeId,
                pinKey: (event as { pinKey: string }).pinKey,
              }),
            }),
          },
        },
      },
      validatingDebounce: {
        entry: assign({ validationStatus: () => "validating" }),
        after: {
          300: "validating",
        },
        on: {
          JSON_EDIT: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => true,
            }),
          },
          SYNC_JSON: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => false,
            }),
          },
          APPLY_JSON: "applyingJson",
          GRAPH_UPDATED: {
            target: "validatingDebounce",
            actions: assign({
              graph: ({ event }) => (event as { graph: Graph }).graph,
              lastGoodGraph: ({ event }) => (event as { graph: Graph }).graph,
              jsonDraft: ({ context, event }) =>
                context.jsonDirty ? context.jsonDraft : stringifyGraph((event as { graph: Graph }).graph),
            }),
          },
        },
      },
      validating: {
        invoke: {
          src: fromPromise(({ input }) => Promise.resolve(validateGraphWithRegistry(input))),
          input: ({ context }) => context.graph,
          onDone: {
            target: "editing",
            actions: assign({
              validationStatus: ({ event }) =>
                (event.output as { ok: boolean }).ok ? "valid" : "invalid",
              validationErrors: ({ event }) =>
                (event.output as { errors: ValidationError[] }).errors,
            }),
          },
          onError: {
            target: "editing",
            actions: assign({
              validationStatus: () => "invalid",
              validationErrors: ({ event }) => [
                { message: event.error instanceof Error ? event.error.message : "Validation failed." },
              ],
            }),
          },
        },
        on: {
          JSON_EDIT: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => true,
            }),
          },
          SYNC_JSON: {
            actions: assign({
              jsonDraft: ({ event }) => (event as { draft: string }).draft,
              jsonError: () => null,
              jsonDirty: () => false,
            }),
          },
          APPLY_JSON: "applyingJson",
          GRAPH_UPDATED: {
            target: "validatingDebounce",
            actions: assign({
              graph: ({ event }) => (event as { graph: Graph }).graph,
              lastGoodGraph: ({ event }) => (event as { graph: Graph }).graph,
              jsonDraft: ({ context, event }) =>
                context.jsonDirty ? context.jsonDraft : stringifyGraph((event as { graph: Graph }).graph),
            }),
          },
        },
      },
      applyingJson: {
        invoke: {
          src: fromPromise(({ input }) => {
            const result = parseGraphJson(input);
            if (!result.ok) {
              return Promise.reject(result.error);
            }
            return Promise.resolve(result.graph);
          }),
          input: ({ context }) => context.jsonDraft,
          onDone: {
            target: "validatingDebounce",
            actions: assign({
              graph: ({ event }) => (event.output as Graph),
              lastGoodGraph: ({ event }) => (event.output as Graph),
              jsonDraft: ({ event }) => stringifyGraph(event.output as Graph),
              jsonError: () => null,
              jsonDirty: () => false,
            }),
          },
          onError: {
            target: "editing",
            actions: assign({
              jsonError: ({ event }) => String(event.error ?? "Invalid JSON"),
            }),
          },
        },
      },
    },
  },
  {}
);
