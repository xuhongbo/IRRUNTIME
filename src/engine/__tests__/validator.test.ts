// 文件说明：自动补充文件级注释，描述模块职责与用途

import { isAssignable, validateGraph } from "../validator";
import { registry } from "../registry";
import type { Registry } from "../registry";
import { z } from "zod";
import type { Graph } from "../ir";
import { sampleGraph } from "../../mock/graph";

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
    expect(result.errors.some((err) => err.message.includes("入口节点"))).toBe(true);
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
    expect(result.errors.some((err) => err.message.includes("不兼容的数据类型"))).toBe(true);
  });

  it("allows same-type data connections", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "a", type: "ConstString", version: 1, props: { value: "x" }, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { title: "T" }, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "e2", from: { nodeId: "show", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "a", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
      ],
      "start"
    );
    const result = validateGraph(graph, registry);
    expect(result.errors.some((err) => err.message.includes("不兼容的数据类型"))).toBe(false);
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
    expect(result.errors.some((err) => err.message.includes("必填输入端口"))).toBe(true);
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
    expect(result.errors.some((err) => err.message.includes("边 ID 重复"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("执行输出"))).toBe(true);
  });

  it("flags unknown node types and invalid props", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "bad", type: "Unknown", version: 1, props: {}, pos: basePos },
        { id: "show", type: "ShowText", version: 2, props: { label: "bad" }, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "e2", from: { nodeId: "show", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
      ],
      "start"
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("未知节点类型"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("节点属性"))).toBe(true);
  });

  it("flags duplicate contract names", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }]
    );
    graph.contract = {
      inputs: [
        { name: "x", type: "string", required: true },
        { name: "x", type: "string", required: false },
      ],
      outputs: [
        { name: "y", type: "number", required: true },
        { name: "y", type: "number", required: false },
      ],
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("图输入名称重复"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("图输出名称重复"))).toBe(true);
  });

  it("flags contract defaultValue type mismatch", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }]
    );
    graph.contract = {
      inputs: [{ name: "x", type: "number", defaultValue: "bad" }],
      outputs: [{ name: "y", type: "boolean", defaultValue: "bad" }],
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("默认值类型不匹配"))).toBe(true);
  });

  it("flags unknown edge node type", () => {
    const graph = makeGraph(
      [
        { id: "a", type: "Unknown", version: 1, props: {}, pos: basePos },
        { id: "b", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [{ id: "e1", from: { nodeId: "a", pinKey: "out" }, to: { nodeId: "b", pinKey: "in" } }]
    );
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.message.includes("未知节点类型"))).toBe(true);
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
    expect(result.errors.some((err) => err.message.includes("不兼容的端口类型"))).toBe(true);
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
    expect(result.errors.some((err) => err.message.includes("执行输入"))).toBe(true);
    expect(result.errors.some((err) => err.message.includes("数据输入"))).toBe(true);
  });

  it("allows data to connect to json inputs", () => {
    const graph = makeGraph(
      [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "num", type: "ConstNumber", version: 1, props: { value: 1 }, pos: basePos },
        { id: "set", type: "SetVar", version: 1, props: {}, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "set", pinKey: "in" } },
        { id: "e2", from: { nodeId: "set", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "num", pinKey: "value" }, to: { nodeId: "set", pinKey: "value" } },
      ],
      "start"
    );
    const result = validateGraph(graph, registry);
    expect(result.errors.some((err) => err.message.includes("不兼容的数据类型"))).toBe(false);
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
    expect(result.errors.some((err) => err.message.includes("缺失"))).toBe(true);
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
              category: "流程",
              doc: { summary: "" },
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
    expect(result.errors.some((err) => err.message.includes("未知节点类型"))).toBe(true);
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
    expect(result.errors.some((err) => err.message.includes("终点端口"))).toBe(true);
  });

  it("flags missing graph outputs", () => {
    const graph: Graph = {
      id: "g",
      version: 1,
      entryNodeId: "start",
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
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
      nodes: [
        { id: "start", type: "Start", version: 1, props: {}, pos: basePos },
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
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
        { id: "end", type: "End", version: 1, props: {}, pos: basePos },
      ],
      edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
      contract: { inputs: [{ name: "good", type: "string" }], outputs: [] },
    };
    const result = validateGraph(graph, registry);
    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.nodeId === "in")).toBe(true);
    expect(result.errors.some((err) => err.nodeId === "out")).toBe(true);
  });
});
