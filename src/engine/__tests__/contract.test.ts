// 文件说明：自动补充文件级注释，描述模块职责与用途

import type { Graph } from "../ir";
import {
  normalizeContract,
  resolveNodeDefinition,
  findContractPort,
  buildGraphInputPins,
  buildGraphOutputPins,
  listContractNames,
  hasDuplicateNames,
} from "../contract";
import { registry } from "../registry";

const baseGraph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    { id: "in", type: "GraphInput", version: 1, props: { name: "foo" }, pos: { x: 0, y: 100 } },
    { id: "out", type: "GraphOutput", version: 1, props: { name: "bar" }, pos: { x: 0, y: 200 } },
  ],
  edges: [],
  contract: {
    inputs: [{ name: "foo", type: "string" }],
    outputs: [{ name: "bar", type: "number" }],
  },
};

describe("contract helpers", () => {
  it("normalizes missing contract", () => {
    const normalized = normalizeContract(undefined);
    expect(normalized.inputs).toEqual([]);
    expect(normalized.outputs).toEqual([]);
  });

  it("resolves graph input/output pins from contract", () => {
    const graphInput = baseGraph.nodes[1];
    const graphOutput = baseGraph.nodes[2];
    const inputResolved = resolveNodeDefinition(graphInput, baseGraph, registry);
    const outputResolved = resolveNodeDefinition(graphOutput, baseGraph, registry);
    expect(inputResolved?.outputs[0].dataType).toBe("string");
    expect(outputResolved?.inputs[1].dataType).toBe("number");
  });

  it("finds ports and builds pin definitions", () => {
    const port = findContractPort(baseGraph, "inputs", "foo");
    expect(port?.type).toBe("string");
    const pins = buildGraphInputPins(baseGraph, "foo");
    expect(pins[0].dataType).toBe("string");
    const outputPins = buildGraphOutputPins(baseGraph, "bar");
    expect(outputPins[1].dataType).toBe("number");
  });

  it("handles empty names and non-string props", () => {
    const pins = buildGraphInputPins(baseGraph, "");
    expect(pins[0].label).toBe("输入");
    const outputPins = buildGraphOutputPins(baseGraph, "");
    expect(outputPins[1].label).toBe("输出");
    const weirdNode = { ...baseGraph.nodes[1], props: { name: 123 } };
    const resolved = resolveNodeDefinition(weirdNode, baseGraph, registry);
    expect(resolved?.outputs[0].dataType).toBe("json");
  });

  it("lists names and detects duplicates", () => {
    const contract = normalizeContract(baseGraph.contract);
    const names = listContractNames(contract);
    expect(names.inputs).toEqual(["foo"]);
    expect(names.outputs).toEqual(["bar"]);
    expect(hasDuplicateNames(["a", "a"])).toBe(true);
    expect(hasDuplicateNames(["a", "b"])).toBe(false);
    expect(contract.outputs[0].required).toBe(true);
  });
});
