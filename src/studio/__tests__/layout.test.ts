import type { Graph } from "../../engine/ir";
import { getGraphCenter } from "../layout";

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
});
