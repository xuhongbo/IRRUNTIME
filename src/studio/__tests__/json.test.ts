import { parseGraphJson, stringifyGraph } from "../json";
import type { Graph } from "../../engine/ir";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } }],
  edges: [],
};

describe("json helpers", () => {
  it("parses valid JSON", () => {
    const result = parseGraphJson(JSON.stringify(graph));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.graph.id).toBe("g");
    }
  });

  it("returns error on invalid JSON", () => {
    const result = parseGraphJson("{ invalid");
    expect(result.ok).toBe(false);
  });

  it("handles non-Error parse failures", () => {
    const spy = jest.spyOn(JSON, "parse").mockImplementation(() => {
      throw "bad";
    });
    const result = parseGraphJson("{ broken");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid JSON");
    }
    spy.mockRestore();
  });

  it("stringifies graph", () => {
    const output = stringifyGraph(graph);
    expect(output).toContain('"id": "g"');
  });
});
