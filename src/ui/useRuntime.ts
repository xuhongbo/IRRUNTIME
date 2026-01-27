import { useEffect, useMemo } from "react";
import { useMachine } from "@xstate/react";
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { GraphRuntime } from "../engine/runtime";
import { createRuntimeMachine } from "../studio/runtimeMachine";

export const useRuntime = (graph: Graph, registry: Registry) => {
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("runtime:init");
    }
  }
  const runtime = useMemo(() => new GraphRuntime(graph, registry), [registry]);
  const runtimeMachine = useMemo(() => createRuntimeMachine(runtime), [runtime]);
  const [state, send] = useMachine(runtimeMachine);
  const snapshot = state.context.snapshot;

  useEffect(() => {
    const unsubscribe = runtime.subscribe((next) => send({ type: "RUNTIME_UPDATED", snapshot: next }));
    return () => {
      unsubscribe();
    };
  }, [runtime, send]);

  useEffect(() => {
    send({ type: "SET_GRAPH", graph });
  }, [graph, send]);

  return { runtime, snapshot, send };
};
