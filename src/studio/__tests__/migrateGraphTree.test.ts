// 文件说明：自动补充文件级注释，描述模块职责与用途

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
