import { createActor } from "xstate";
import { studioMachine } from "../machine";
import type { Graph } from "../../engine/ir";

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("studioMachine", () => {
  it("does not overwrite graph on invalid JSON", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    actor.send({ type: "JSON_EDIT", draft: "{ invalid" });
    actor.send({ type: "APPLY_JSON" });
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.jsonError).toBeTruthy();
    expect(state.context.graph).toBe(initial);
  });

  it("validates graph after debounce on update", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    const next: Graph = { ...initial, id: "next" };
    actor.send({ type: "GRAPH_UPDATED", graph: next });
    await flushMicrotasks();
    expect(actor.getSnapshot().context.validationStatus).toBe("validating");
    expect(actor.getSnapshot().context.jsonDraft).toContain("\"next\"");
    await new Promise((resolve) => setTimeout(resolve, 320));
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.validationStatus).toBe("valid");
    expect(state.context.graph.id).toBe("next");
  });

  it("applies valid JSON and updates draft", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    const next = { ...initial, id: "updated" };
    actor.send({ type: "JSON_EDIT", draft: JSON.stringify(next) });
    actor.send({ type: "APPLY_JSON" });
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.graph.id).toBe("updated");
    expect(state.context.jsonError).toBeNull();
    expect(state.context.jsonDraft).toContain("\"updated\"");
    expect(state.context.jsonDirty).toBe(false);
  });

  it("records validation errors for invalid graph", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    const invalid = { ...initial, entryNodeId: "missing" };
    actor.send({ type: "GRAPH_UPDATED", graph: invalid });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.validationStatus).toBe("invalid");
    expect(state.context.validationErrors.length).toBeGreaterThan(0);
  });

  it("updates selection", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "SELECT_NODE", nodeId: "custom" });
    await flushMicrotasks();
    expect(actor.getSnapshot().context.selectedNodeId).toBe("custom");
  });

  it("does not overwrite dirty JSON drafts on graph updates", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "JSON_EDIT", draft: "{\"id\":\"draft\"}" });
    const initial = actor.getSnapshot().context.graph;
    actor.send({ type: "GRAPH_UPDATED", graph: { ...initial, id: "g1" } });
    await flushMicrotasks();
    expect(actor.getSnapshot().context.jsonDraft).toBe("{\"id\":\"draft\"}");
  });

  it("applies JSON while validating debounce is active", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    actor.send({ type: "GRAPH_UPDATED", graph: { ...initial, id: "pending" } });
    actor.send({ type: "JSON_EDIT", draft: JSON.stringify({ ...initial, id: "from-json" }) });
    actor.send({ type: "APPLY_JSON" });
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.graph.id).toBe("from-json");
    expect(state.context.jsonError).toBeNull();
  });

  it("syncs JSON drafts from graph", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    actor.send({ type: "SYNC_JSON", draft: JSON.stringify({ ...initial, id: "synced" }) });
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.jsonDraft).toContain("\"synced\"");
    expect(state.context.jsonDirty).toBe(false);
  });

  it("focuses pins from errors", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "FOCUS_PIN", nodeId: "n1", pinKey: "in" });
    await flushMicrotasks();
    const state = actor.getSnapshot();
    expect(state.context.selectedNodeId).toBe("n1");
    expect(state.context.focusedPin).toEqual({ nodeId: "n1", pinKey: "in" });
  });

  it("coalesces updates during debounce", async () => {
    const actor = createActor(studioMachine).start();
    const initial = actor.getSnapshot().context.graph;
    const g1: Graph = { ...initial, id: "g1" };
    const g2: Graph = { ...initial, id: "g2" };
    actor.send({ type: "GRAPH_UPDATED", graph: g1 });
    actor.send({ type: "GRAPH_UPDATED", graph: g2 });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await flushMicrotasks();
    expect(actor.getSnapshot().context.graph.id).toBe("g2");
  });
});
