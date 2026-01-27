import type { RunMeta, TraceEntry } from "../engine/runtime";

export const formatTraceJson = (runMeta: RunMeta, trace: TraceEntry[]) => {
  return JSON.stringify({ meta: runMeta, entries: trace }, null, 2);
};
