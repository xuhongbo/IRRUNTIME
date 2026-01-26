jest.mock("../validation", () => ({
  validateGraphWithRegistry: () =>
    new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true, errors: [] }), 10);
    }),
}));

import { createActor } from "xstate";
import { studioMachine } from "../machine";
import type { Graph } from "../../engine/ir";

describe("studioMachine updates during validating", () => {
  it("accepts graph updates while validating", async () => {
    jest.useFakeTimers();
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    const g1: Graph = { ...initial, id: "g1" };
    const g2: Graph = { ...initial, id: "g2" };
    actor.send({ type: "GRAPH_UPDATED", graph: g1 });
    jest.advanceTimersByTime(300);
    await Promise.resolve();
    actor.send({ type: "GRAPH_UPDATED", graph: g2 });
    jest.advanceTimersByTime(300);
    jest.advanceTimersByTime(20);
    await Promise.resolve();
    const state = actor.getSnapshot();
    expect(state.context.graph.id).toBe("g2");
    jest.useRealTimers();
  });
});
