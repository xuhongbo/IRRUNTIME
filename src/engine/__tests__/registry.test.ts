// 文件说明：自动补充文件级注释，描述模块职责与用途

import { registry } from "../registry";
import type { Graph } from "../ir";

describe("registry", () => {
  it("gets definitions and latest versions", () => {
    const start = registry.get("Start", 1);
    const show = registry.get("ShowText");
    const latestShow = registry.getLatest("ShowText");
    expect(start?.type).toBe("Start");
    expect(show?.type).toBe("ShowText");
    expect(latestShow?.version).toBe(2);
  });

  it("returns null for unknown types", () => {
    expect(registry.getLatest("MissingType")).toBeNull();
  });

  it("lists types sorted", () => {
    const types = registry.listTypes();
    expect(types).toContain("Start");
    const sorted = [...types].sort();
    expect(types).toEqual(sorted);
  });

  it("migrates nodes to latest versions", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "a",
      nodes: [
        {
          id: "a",
          type: "Start",
          version: 1,
          props: {},
          pos: { x: 0, y: 0 },
        },
        {
          id: "b",
          type: "ShowText",
          version: 1,
          props: { label: "Hello" },
          pos: { x: 100, y: 0 },
        },
      ],
      edges: [
        { id: "e1", from: { nodeId: "a", pinKey: "next" }, to: { nodeId: "b", pinKey: "in" } },
      ],
    };
    const result = registry.migrateGraph(graph);
    const migrated = result.graph.nodes.find((node) => node.id === "b");
    expect(migrated?.version).toBe(2);
    expect(migrated?.props).toEqual({ title: "Hello" });
    expect(result.migrations.length).toBe(1);
  });

  it("skips migration for unknown or already-latest nodes", () => {
    const graph = {
      id: "g2",
      version: 1,
      entryNodeId: "a",
      nodes: [
        { id: "a", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
        { id: "b", type: "Unknown", version: 1, props: {}, pos: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const result = registry.migrateGraph(graph);
    expect(result.migrations.length).toBe(0);
    expect(result.graph.nodes[1].type).toBe("Unknown");
  });

  it("handles missing migration functions gracefully", () => {
    const graph = {
      id: "g3",
      version: 1,
      entryNodeId: "a",
      nodes: [
        { id: "a", type: "ShowText", version: 0, props: { label: "Hi" }, pos: { x: 0, y: 0 } },
      ],
      edges: [],
    };
    const result = registry.migrateGraph(graph);
    expect(result.graph.nodes[0].version).toBe(0);
    expect(result.migrations.length).toBe(0);
  });
});
