import type { Graph } from "../../engine/ir";
import { applyCommand } from "../commands";

const pos = { x: 0, y: 0 };

const baseGraph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos }],
  edges: [],
};

describe("applyCommand", () => {
  it("adds nodes", () => {
    const next = applyCommand(baseGraph, {
      type: "ADD_NODE",
      node: { id: "end", type: "End", version: 1, props: {}, pos },
    });
    expect(next.nodes.length).toBe(2);
  });

  it("deletes nodes and connected edges", () => {
    const graph: Graph = {
      ...baseGraph,
      nodes: [
        ...baseGraph.nodes,
        { id: "end", type: "End", version: 1, props: {}, pos },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
    };
    const next = applyCommand(graph, { type: "DELETE_NODE", nodeId: "end" });
    expect(next.nodes.some((node) => node.id === "end")).toBe(false);
    expect(next.edges.length).toBe(0);
  });

  it("moves nodes", () => {
    const graph: Graph = {
      ...baseGraph,
      nodes: [
        ...baseGraph.nodes,
        { id: "other", type: "End", version: 1, props: {}, pos },
      ],
    };
    const next = applyCommand(graph, {
      type: "MOVE_NODE",
      nodeId: "start",
      pos: { x: 10, y: 20 },
    });
    expect(next.nodes[0].pos).toEqual({ x: 10, y: 20 });
    expect(next.nodes[1].pos).toEqual(pos);
  });

  it("sets props", () => {
    const graph: Graph = {
      ...baseGraph,
      nodes: [
        ...baseGraph.nodes,
        { id: "other", type: "End", version: 1, props: {}, pos },
      ],
    };
    const next = applyCommand(graph, {
      type: "SET_PROP",
      nodeId: "start",
      props: { label: "X" },
    });
    expect(next.nodes[0].props).toEqual({ label: "X" });
    expect(next.nodes[1].props).toEqual({});
  });

  it("connects and disconnects edges", () => {
    const connected = applyCommand(baseGraph, {
      type: "CONNECT",
      edge: { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "start", pinKey: "next" } },
    });
    expect(connected.edges.length).toBe(1);
    const disconnected = applyCommand(connected, { type: "DISCONNECT", edgeId: "e1" });
    expect(disconnected.edges.length).toBe(0);
  });

  it("sets graph contract", () => {
    const next = applyCommand(baseGraph, {
      type: "SET_CONTRACT",
      contract: { inputs: [{ name: "foo", type: "string" }], outputs: [] },
    });
    expect(next.contract?.inputs[0].name).toBe("foo");
  });

  it("sets presets", () => {
    const next = applyCommand(baseGraph, {
      type: "SET_PRESETS",
      presets: [{ id: "p1", title: "Preset", inputs: {} }],
    });
    expect(next.presets?.length).toBe(1);
  });

  it("applies JSON graph replacement", () => {
    const nextGraph: Graph = {
      id: "next",
      version: 2,
      entryNodeId: "end",
      nodes: [{ id: "end", type: "End", version: 1, props: {}, pos }],
      edges: [],
    };
    const next = applyCommand(baseGraph, { type: "APPLY_JSON", graph: nextGraph });
    expect(next).toBe(nextGraph);
    expect(next.id).toBe("next");
  });

  it("returns graph on unknown command", () => {
    const next = applyCommand(baseGraph, { type: "UNKNOWN" } as unknown as never);
    expect(next).toBe(baseGraph);
  });
});
