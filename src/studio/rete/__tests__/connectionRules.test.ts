import type { Graph } from "../../../engine/ir";
import { registry } from "../../../engine/registry";
import { canConnectEndpoints, connectionToEdge } from "../connectionRules";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    { id: "a", type: "ConstNumber", version: 1, props: { value: 1 }, pos: { x: 100, y: 0 } },
    { id: "b", type: "ConstString", version: 1, props: { value: "B" }, pos: { x: 200, y: 0 } },
    { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: { x: 300, y: 0 } },
  ],
  edges: [
    { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
    { id: "d1", from: { nodeId: "b", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
  ],
};

describe("connectionRules", () => {
  it("blocks incompatible data types", () => {
    const decision = canConnectEndpoints(
      graph,
      registry,
      { nodeId: "a", pinKey: "value", side: "output" },
      { nodeId: "show", pinKey: "text", side: "input" }
    );
    expect(decision.ok).toBe(false);
  });

  it("blocks multiple incoming connections", () => {
    const decision = canConnectEndpoints(
      graph,
      registry,
      { nodeId: "b", pinKey: "value", side: "output" },
      { nodeId: "show", pinKey: "text", side: "input" }
    );
    expect(decision.ok).toBe(false);
  });

  it("allows valid exec connections", () => {
    const fresh: Graph = {
      ...graph,
      edges: [],
    };
    const decision = canConnectEndpoints(
      fresh,
      registry,
      { nodeId: "start", pinKey: "next", side: "output" },
      { nodeId: "show", pinKey: "in", side: "input" }
    );
    expect(decision.ok).toBe(true);
  });

  it("blocks non output-input direction", () => {
    const decision = canConnectEndpoints(
      graph,
      registry,
      { nodeId: "show", pinKey: "in", side: "input" },
      { nodeId: "b", pinKey: "value", side: "output" }
    );
    expect(decision.ok).toBe(false);
  });

  it("blocks missing pins", () => {
    const decision = canConnectEndpoints(
      graph,
      registry,
      { nodeId: "show", pinKey: "missing", side: "output" },
      { nodeId: "b", pinKey: "value", side: "input" }
    );
    expect(decision.ok).toBe(false);
  });

  it("blocks duplicate connections", () => {
    const decision = canConnectEndpoints(
      graph,
      registry,
      { nodeId: "b", pinKey: "value", side: "output" },
      { nodeId: "show", pinKey: "text", side: "input" }
    );
    expect(decision.ok).toBe(false);
  });

  it("blocks multiple exec outputs from same pin", () => {
    const execGraph: Graph = {
      ...graph,
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } }],
    };
    const decision = canConnectEndpoints(
      execGraph,
      registry,
      { nodeId: "start", pinKey: "next", side: "output" },
      { nodeId: "b", pinKey: "in", side: "input" }
    );
    expect(decision.ok).toBe(false);
  });

  it("maps connections to edges", () => {
    const edge = connectionToEdge({
      id: "c1",
      source: "a",
      sourceOutput: "value",
      target: "show",
      targetInput: "text",
    });
    expect(edge).toEqual({
      id: "c1",
      from: { nodeId: "a", pinKey: "value" },
      to: { nodeId: "show", pinKey: "text" },
    });
  });
});
