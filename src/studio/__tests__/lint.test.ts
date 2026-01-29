// 文件说明：自动补充文件级注释，描述模块职责与用途

import type { Graph } from "../../engine/ir";
import { lintGraph } from "../lint";

describe("lintGraph", () => {
  it("detects isolated nodes", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
        { id: "solo", type: "ShowText", version: 1, props: {}, pos: { x: 100, y: 0 } },
      ],
      edges: [],
    };
    const issues = lintGraph(graph);
    expect(issues.some((issue) => issue.id.includes("isolated"))).toBe(true);
  });

  it("skips connected start/end", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
        { id: "end", type: "End", version: 1, props: {}, pos: { x: 100, y: 0 } },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
    };
    const issues = lintGraph(graph);
    expect(issues.length).toBe(0);
  });
});
