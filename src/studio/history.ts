// 文件说明：自动补充文件级注释，描述模块职责与用途

// 历史记录：支持撤销与重做
import type { Graph } from "../engine/ir";

// 历史状态结构
export type HistoryState = {
  past: Graph[];
  future: Graph[];
  limit: number;
};

// 创建历史状态
export const createHistoryState = (limit: number = 50): HistoryState => ({
  past: [],
  future: [],
  limit,
});

// 推入历史快照
export const pushHistory = (state: HistoryState, snapshot: Graph): HistoryState => {
  const nextPast = [...state.past, snapshot];
  const trimmedPast = nextPast.length > state.limit ? nextPast.slice(nextPast.length - state.limit) : nextPast;
  return { ...state, past: trimmedPast, future: [] };
};

// 是否可撤销
export const canUndo = (state: HistoryState) => state.past.length > 0;

// 是否可重做
export const canRedo = (state: HistoryState) => state.future.length > 0;

// 撤销并返回上一个图快照
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

// 重做并返回下一图快照
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
