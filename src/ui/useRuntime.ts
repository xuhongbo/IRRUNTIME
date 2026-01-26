import { useEffect, useMemo, useState } from "react";
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { GraphRuntime } from "../engine/runtime";
import type { RuntimeSnapshot } from "../engine/runtime";

export const useRuntime = (graph: Graph, registry: Registry) => {
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("runtime:init");
    }
  }
  const runtime = useMemo(() => new GraphRuntime(graph, registry), [registry]);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(runtime.getSnapshot());

  useEffect(() => {
    const unsubscribe = runtime.subscribe(setSnapshot);
    return () => {
      unsubscribe();
    };
  }, [runtime]);

  useEffect(() => {
    runtime.setGraph(graph);
  }, [graph, runtime]);

  return { runtime, snapshot };
};
