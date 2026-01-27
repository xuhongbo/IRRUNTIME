import { isAssignable, validateGraph } from "../validator";
import { registry } from "../registry";
import type { Registry } from "../registry";
import { z } from "zod";
import type { Graph } from "../ir";
import { sampleGraph } from "../sampleGraph";

const basePos = { x: 0, y: 0 };

const makeGraph = (nodes: Graph["nodes"], edges: Graph["edges"], entry = nodes[0]?.id ?? ""): Graph => ({
  id: "g",
  version: 1,
  entryNodeId: entry,
  nodes,
  edges,
});

describe("validateGraph", () => {
  it("validates a known-good graph", () => {
    const migrated = registry.migrateGraph(sampleGraph).graph;
    const result = validateGraph(migrated, registry);
    expect(result.ok).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("flags missing entry node", () => {
    const graph = makeGraph(
      [{ id: "a", type: "Start", version: 1, props: {}, pos: basePos }],
      [],
      "missing"
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Entry node"))).toBe(true);
  });

  it("flags incompatible data types", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "num", type: "ConstNumber", version: 1, props: { value: 2 }, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "d1", from: { nodeId: "num", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
      ]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("incompatible data types"))).toBe(true);
  });

  it("allows same-type data connections", () => {
    const graph = makeGraph(
      [
        { id: "a", type: "ConstString", version: 1, props: { value: "x" }, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: basePos },
      ],
      [{ id: "d1", from: { nodeId: "a", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } }],
      "a"
    );
    const result = validateGraph(graph, registry);
    expect(result.errors.some((err) => err.message.includes("incompatible data types"))).toBe(false);
  });

  it("flags required data input missing", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } }]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Required input"))).toBe(true);
  });

  it("flags duplicate edge id and multiple exec outputs", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "endA", type: "End", version: 1, props: {}, pos: basePos },
        { id: "endB", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "dup", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "endA", pinKey: "in" } },
        { id: "dup", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "endB", pinKey: "in" } },
      ]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Duplicate edge id"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("Exec output"))).toBe(true);
  });

  it("flags unknown node types and invalid props", () => {
    const graph = makeGraph(
      [
        { id: "bad", type: "Unknown", version: 1, props: {}, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { label: "bad" }, pos: basePos },
      ],
      []
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Unknown node type"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("props failed"))).toBe(true);
  });

  it("flags incompatible pin kinds", () => {
    const graph = makeGraph(
      [
        { id: "num", type: "ConstNumber", version: 1, props: { value: 1 }, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "num", pinKey: "value" }, to: { nodeId: "end", pinKey: "in" } },
      ]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("incompatible pin kinds"))).toBe(true);
  });

  it("flags multiple incoming exec/data inputs", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "branch", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: basePos },
        { id: "s1", type: "ConstString", version: 1, props: { value: "A" }, pos: basePos },
        { id: "s2", type: "ConstString", version: 1, props: { value: "B" }, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "e2", from: { nodeId: "branch", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "d1", from: { nodeId: "s1", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
        { id: "d2", from: { nodeId: "s2", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
      ]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Exec input"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("Data input"))).toBe(true);
  });

  it("allows data to connect to json inputs", () => {
    const graph = makeGraph(
      [
        { id: "num", type: "ConstNumber", version: 1, props: { value: 1 }, pos: basePos },
        { id: "set", type: "SetVar", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "d1", from: { nodeId: "num", pinKey: "value" }, to: { nodeId: "set", pinKey: "value" } },
      ],
      "num"
    );
    const result = validateGraph(graph, registry);
    expect(result.errors.some((err) => err.message.includes("incompatible data types"))).toBe(false);
  });

  it("handles missing nodes and pins", () => {
    const graph = makeGraph(
      [{ id: "start", type: "Start", version: 1, props: {}, pos: basePos }],
      [
        { id: "e1", from: { nodeId: "missing", pinKey: "out" }, to: { nodeId: "start", pinKey: "in" } },
        { id: "e2", from: { nodeId: "start", pinKey: "bad" }, to: { nodeId: "start", pinKey: "in" } },
        { id: "e3", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "missing-target", pinKey: "in" } },
      ]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("missing"))).toBe(true);
  });

  it("treats undefined data types as assignable", () => {
    const customRegistry: Registry = {
      get: (type) =>
        type === "A" || type === "B"
          ? {
              type,
              version: 1,
              title: type,
              description: "",
              inputs: type === "B" ? [{ key: "x", label: "x", kind: "data" }] : [],
              outputs: type === "A" ? [{ key: "x", label: "x", kind: "data" }] : [],
              propsSchema: z.object({}).strict(),
              defaultProps: {},
              form: [],
              run: () => ({ data: {} }),
            }
          : null,
      getLatest: () => null,
      listTypes: () => [],
      migrateGraph: (g) => ({ graph: g, migrations: [] }),
    };
    const graph = makeGraph(
      [
        { id: "a", type: "A", version: 1, props: {}, pos: basePos },
        { id: "b", type: "B", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "a", pinKey: "x" }, to: { nodeId: "b", pinKey: "x" } }]
    );
    const result = validateGraph(graph, customRegistry);
    expect(result.ok).toBe(true);
  });

  it("allows json as a compatible target", () => {
    expect(isAssignable("string", "json")).toBe(true);
    expect(isAssignable("number", "number")).toBe(true);
    expect(isAssignable("boolean", "string")).toBe(false);
  });

  it("flags unknown node types referenced by edges", () => {
    const graph = makeGraph(
      [
        { id: "a", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "b", type: "Unknown", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "a", pinKey: "next" }, to: { nodeId: "b", pinKey: "in" } }]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("Unknown node type"))).toBe(true);
  });

  it("flags missing target pins", () => {
    const graph = makeGraph(
      [
        { id: "a", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "b", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "a", pinKey: "next" }, to: { nodeId: "b", pinKey: "bad" } }]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("target pin"))).toBe(true);
  });

  it("flags missing graph outputs", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos: basePos }],
      edges: [],
      contract: { inputs: [], outputs: [{ name: "result", type: "string" }] },
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("result"))).toBe(true);
  });

  it("does not require optional graph outputs", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos: basePos }],
      edges: [],
      contract: { inputs: [], outputs: [{ name: "opt", type: "string", required: false }] },
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(true);
  });

  it("flags graph input/output names not in contract", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "in", type: "GraphInput", version: 1, props: { name: "foo" }, pos: basePos },
        { id: "out", type: "GraphOutput", version: 1, props: { name: "bar" }, pos: basePos },
      ],
      edges: [],
      contract: { inputs: [{ name: "good", type: "string" }], outputs: [] },
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.nodeId === "in")).toBe(true);
    expect(result.errors.some((err) => err.nodeId === "out")).toBe(true);
  });
});
