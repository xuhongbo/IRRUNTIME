// 文件说明：自动补充文件级注释，描述模块职责与用途

import type { Graph } from "../../engine/ir";
import { alignNodes, distributeNodes } from "../align";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "a",
  nodes: [
    { id: "a", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    { id: "b", type: "End", version: 1, props: {}, pos: { x: 100, y: 50 } },
    { id: "c", type: "End", version: 1, props: {}, pos: { x: 200, y: 100 } },
  ],
  edges: [],
};

describe("align helpers", () => {
  it("aligns left", () => {
    const cmds = alignNodes(graph, ["a", "b"], "left");
    expect(cmds.length).toBe(1);
    expect(cmds[0].pos.x).toBe(0);
  });

  it("aligns right and bottom", () => {
    const right = alignNodes(graph, ["a", "b"], "right");
    expect(right[0].pos.x).toBe(100);
    const bottom = alignNodes(graph, ["a", "c"], "bottom");
    expect(bottom[0].pos.y).toBe(100);
  });

  it("aligns centerY", () => {
    const cmds = alignNodes(graph, ["a", "b"], "centerY");
    expect(cmds[0].pos.y).toBe(25);
  });

  it("distributes horizontally", () => {
    const cmds = distributeNodes(graph, ["a", "b", "c"], "horizontal");
    expect(cmds.length).toBe(3);
    expect(cmds[1].pos.x).toBe(100);
  });

  it("distributes vertically", () => {
    const cmds = distributeNodes(graph, ["a", "b", "c"], "vertical");
    expect(cmds[1].pos.y).toBe(50);
  });

  it("returns empty for insufficient nodes", () => {
    const cmds = distributeNodes(graph, ["a", "b"], "vertical");
    expect(cmds.length).toBe(0);
  });
});
