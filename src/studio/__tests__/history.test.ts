// 文件说明：自动补充文件级注释，描述模块职责与用途

import type { Graph } from "../../engine/ir";
import { canRedo, canUndo, createHistoryState, pushHistory, redoHistory, undoHistory } from "../history";

const graph = (id: string): Graph => ({
  id,
  version: 1,
  entryNodeId: "start",
  nodes: [],
  edges: [],
});

describe("history", () => {
  it("pushes snapshots and clears future", () => {
    const state = createHistoryState(2);
    const next = pushHistory(state, graph("a"));
    expect(next.past.length).toBe(1);
    expect(next.future.length).toBe(0);
  });

  it("trims past by limit", () => {
    let state = createHistoryState(2);
    state = pushHistory(state, graph("a"));
    state = pushHistory(state, graph("b"));
    state = pushHistory(state, graph("c"));
    expect(state.past.length).toBe(2);
    expect(state.past[0].id).toBe("b");
  });

  it("undo/redo transitions", () => {
    let state = createHistoryState(5);
    state = pushHistory(state, graph("a"));
    state = pushHistory(state, graph("b"));
    expect(canUndo(state)).toBe(true);
    const undo = undoHistory(state, graph("current"));
    expect(undo.graph?.id).toBe("b");
    expect(canRedo(undo.state)).toBe(true);
    const redo = redoHistory(undo.state, graph("now"));
    expect(redo.graph?.id).toBe("current");
  });

  it("returns null when no history", () => {
    const state = createHistoryState();
    const undo = undoHistory(state, graph("current"));
    const redo = redoHistory(state, graph("current"));
    expect(undo.graph).toBeNull();
    expect(redo.graph).toBeNull();
  });
});
