import type { Graph } from "../../engine/ir";
import { autoLayoutGraph, getGraphCenter } from "../layout";

describe("getGraphCenter", () => {
  it("returns origin for empty graph", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "none",
      nodes: [],
      edges: [],
    };
    expect(getGraphCenter(graph)).toEqual({ x: 0, y: 0 });
  });

  it("computes center from node bounds", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "a",
      nodes: [
        { id: "a", type: "Start", version: 1, props: {}, pos: { x: -20, y: 10 } },
        { id: "b", type: "End", version: 1, props: {}, pos: { x: 40, y: 50 } },
      ],
      edges: [],
    };
    expect(getGraphCenter(graph)).toEqual({ x: 10, y: 30 });
  });

  it("auto layouts by depth", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
        { id: "next", type: "End", version: 1, props: {}, pos: { x: 0, y: 0 } },
        { id: "lonely", type: "End", version: 1, props: {}, pos: { x: 0, y: 0 } },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "next", pinKey: "in" } }],
    };
    const commands = autoLayoutGraph(graph, 100, 50);
    expect(commands.length).toBe(3);
    const target = commands.find((cmd) => cmd.nodeId === "next");
    expect(target?.pos.x).toBe(100);
    const lonely = commands.find((cmd) => cmd.nodeId === "lonely");
    expect(lonely?.pos.x).toBe(0);
  });

  it("auto layout empty graph", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "none",
      nodes: [],
      edges: [],
    };
    const commands = autoLayoutGraph(graph);
    expect(commands.length).toBe(0);
  });
});
