import { migrateGraphTree } from "../machine";
import type { Graph } from "../../engine/ir";

describe("migrateGraphTree", () => {
  it("returns main graph when no subgraphs", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } }],
      edges: [],
    };
    const result = migrateGraphTree(graph);
    expect(result.subgraphs).toBeUndefined();
  });
});
