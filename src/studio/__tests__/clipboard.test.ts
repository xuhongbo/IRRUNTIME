import type { Graph } from "../../engine/ir";
import { copySelection, pasteSelection, getSelectionBounds } from "../clipboard";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "a",
  nodes: [
    { id: "a", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    { id: "b", type: "End", version: 1, props: {}, pos: { x: 100, y: 50 } },
    { id: "c", type: "End", version: 1, props: {}, pos: { x: 200, y: 80 } },
  ],
  edges: [
    { id: "e1", from: { nodeId: "a", pinKey: "next" }, to: { nodeId: "b", pinKey: "in" } },
    { id: "e2", from: { nodeId: "b", pinKey: "out" }, to: { nodeId: "c", pinKey: "in" } },
  ],
};

describe("clipboard helpers", () => {
  it("copies nodes and internal edges", () => {
    const payload = copySelection(graph, ["a", "b"]);
    expect(payload?.nodes.length).toBe(2);
    expect(payload?.edges.length).toBe(1);
  });

  it("returns null for empty selection", () => {
    expect(copySelection(graph, [])).toBeNull();
  });

  it("pastes with new ids and offset", () => {
    const payload = copySelection(graph, ["a", "b"])!;
    const pasted = pasteSelection(payload, { x: 10, y: 10 });
    expect(pasted.nodes[0].id).not.toBe("a");
    expect(pasted.nodes[0].pos.x).toBe(10);
  });

  it("computes bounds", () => {
    const bounds = getSelectionBounds(graph.nodes);
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(200);
  });

  it("handles empty bounds", () => {
    const bounds = getSelectionBounds([]);
    expect(bounds.minX).toBe(0);
  });

  it("keeps edge endpoints when id map missing", () => {
    const payload = {
      nodes: [],
      edges: [{ id: "e1", from: { nodeId: "a", pinKey: "out" }, to: { nodeId: "b", pinKey: "in" } }],
    };
    const pasted = pasteSelection(payload, { x: 0, y: 0 });
    expect(pasted.edges[0].from.nodeId).toBe("a");
  });
});
