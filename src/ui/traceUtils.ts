import type { TraceEntry } from "../engine/runtime";

export const formatTraceJson = (trace: TraceEntry[]) => {
  return JSON.stringify(trace, null, 2);
};
