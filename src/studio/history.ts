import type { Graph } from "../engine/ir";

export type HistoryState = {
  past: Graph[];
  future: Graph[];
  limit: number;
};

export const createHistoryState = (limit: number = 50): HistoryState => ({
  past: [],
  future: [],
  limit,
});

export const pushHistory = (state: HistoryState, snapshot: Graph): HistoryState => {
  const nextPast = [...state.past, snapshot];
  const trimmedPast = nextPast.length > state.limit ? nextPast.slice(nextPast.length - state.limit) : nextPast;
  return { ...state, past: trimmedPast, future: [] };
};

export const canUndo = (state: HistoryState) => state.past.length > 0;

export const canRedo = (state: HistoryState) => state.future.length > 0;

export const undoHistory = (
  state: HistoryState,
  current: Graph
): { state: HistoryState; graph: Graph | null } => {
  if (state.past.length === 0) {
    return { state, graph: null };
  }
  const previous = state.past[state.past.length - 1];
  const nextPast = state.past.slice(0, -1);
  const nextFuture = [current, ...state.future];
  return { state: { ...state, past: nextPast, future: nextFuture }, graph: previous };
};

export const redoHistory = (
  state: HistoryState,
  current: Graph
): { state: HistoryState; graph: Graph | null } => {
  if (state.future.length === 0) {
    return { state, graph: null };
  }
  const next = state.future[0];
  const nextFuture = state.future.slice(1);
  const nextPast = [...state.past, current];
  return { state: { ...state, past: nextPast, future: nextFuture }, graph: next };
};
