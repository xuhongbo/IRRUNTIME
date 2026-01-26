import { registry } from "../registry";
import type { Graph, NodeInstance } from "../ir";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [],
  edges: [],
};

const node = (type: string, props: Record<string, unknown> = {}, version?: number): NodeInstance => ({
  id: `${type}-id`,
  type,
  version: version ?? registry.getLatest(type)?.version ?? 1,
  props,
  pos: { x: 0, y: 0 },
});

describe("registry run implementations", () => {
  it("runs basic exec nodes", () => {
    const start = registry.get("Start", 1);
    const end = registry.get("End", 1);
    expect(start?.run({ node: node("Start"), inputs: {}, props: {}, graph, vars: {} }).exec).toBe("next");
    const endResult = end?.run({ node: node("End"), inputs: {}, props: {}, graph, vars: {} });
    expect(endResult?.viewModel?.kind).toBe("done");
  });

  it("runs graph input/output nodes", () => {
    const graphInput = registry.get("GraphInput", 1);
    const graphOutput = registry.get("GraphOutput", 1);
    const inputResult = graphInput?.run({
      node: node("GraphInput", { name: "foo" }),
      inputs: { value: "hello" },
      props: { name: "foo" },
      graph,
      vars: {},
    });
    expect(inputResult?.viewModel?.body).toContain("foo");
    const outputResult = graphOutput?.run({
      node: node("GraphOutput", { name: "bar" }),
      inputs: { value: 123 },
      props: { name: "bar" },
      graph,
      vars: {},
    });
    expect(outputResult?.viewModel?.body).toContain("bar");
  });

  it("runs data nodes and comparisons", () => {
    const equals = registry.get("Equals", 1);
    const result = equals?.run({
      node: node("Equals"),
      inputs: { a: 1, b: 1 },
      props: {},
      graph,
      vars: {},
    });
    expect(result?.data.isEqual).toBe(true);
    const resultFalse = equals?.run({
      node: node("Equals"),
      inputs: { a: 1, b: 2 },
      props: {},
      graph,
      vars: {},
    });
    expect(resultFalse?.data.isEqual).toBe(false);
  });

  it("runs const nodes", () => {
    const constString = registry.get("ConstString", 1);
    const constNumber = registry.get("ConstNumber", 1);
    const constBool = registry.get("ConstBoolean", 1);
    const constJson = registry.get("ConstJson", 1);
    expect(
      constString?.run({ node: node("ConstString", { value: "hi" }), inputs: {}, props: { value: "hi" }, graph, vars: {} })
        .data.value
    ).toBe("hi");
    expect(
      constString?.run({ node: node("ConstString"), inputs: {}, props: {}, graph, vars: {} }).data.value
    ).toBe("");
    expect(
      constNumber?.run({ node: node("ConstNumber", { value: 3 }), inputs: {}, props: { value: 3 }, graph, vars: {} })
        .data.value
    ).toBe(3);
    expect(
      constNumber?.run({ node: node("ConstNumber"), inputs: {}, props: {}, graph, vars: {} }).data.value
    ).toBe(0);
    expect(
      constBool?.run({ node: node("ConstBoolean", { value: true }), inputs: {}, props: { value: true }, graph, vars: {} })
        .data.value
    ).toBe(true);
    expect(
      constBool?.run({ node: node("ConstBoolean"), inputs: {}, props: {}, graph, vars: {} }).data.value
    ).toBe(false);
    expect(
      constJson?.run({ node: node("ConstJson", { value: { k: "v" } }), inputs: {}, props: { value: { k: "v" } }, graph, vars: {} })
        .data.value
    ).toEqual({ k: "v" });
  });

  it("runs variable nodes", () => {
    const vars: Record<string, unknown> = {};
    const setVar = registry.get("SetVar", 1);
    const getVar = registry.get("GetVar", 1);
    setVar?.run({
      node: node("SetVar"),
      inputs: { name: "foo", value: 42 },
      props: {},
      graph,
      vars,
    });
    const result = getVar?.run({
      node: node("GetVar"),
      inputs: { name: "foo" },
      props: {},
      graph,
      vars,
    });
    expect(result?.data.value).toBe(42);
    const missingName = getVar?.run({
      node: node("GetVar"),
      inputs: {},
      props: {},
      graph,
      vars,
    });
    expect(missingName?.data.value).toBeUndefined();

    const setMissing = setVar?.run({
      node: node("SetVar"),
      inputs: {},
      props: {},
      graph,
      vars,
    });
    expect(setMissing?.viewModel?.body).toContain("var");
  });

  it("runs branching nodes", () => {
    const ifNode = registry.get("If", 1);
    const resultTrue = ifNode?.run({
      node: node("If"),
      inputs: { condition: true },
      props: {},
      graph,
      vars: {},
    });
    const resultFalse = ifNode?.run({
      node: node("If"),
      inputs: { condition: false },
      props: {},
      graph,
      vars: {},
    });
    expect(resultTrue?.exec).toBe("then");
    expect(resultFalse?.exec).toBe("else");
  });

  it("runs async/latent nodes", () => {
    const showText = registry.get("ShowText", 2);
    const waitChoice = registry.get("WaitForChoice", 1);
    const delay = registry.get("Delay", 1);
    const showResult = showText?.run({
      node: node("ShowText", { title: "T" }, 2),
      inputs: { text: "Hello" },
      props: { title: "T" },
      graph,
      vars: {},
    });
    expect(showResult?.latent?.kind).toBe("next");
    const showDefault = showText?.run({
      node: node("ShowText", {}, 2),
      inputs: { text: "Hello" },
      props: {},
      graph,
      vars: {},
    });
    expect(showDefault?.viewModel?.title).toBe("Message");
    const showMissingText = showText?.run({
      node: node("ShowText", {}, 2),
      inputs: {},
      props: {},
      graph,
      vars: {},
    });
    expect(showMissingText?.viewModel?.body).toBe("");
    const choiceResult = waitChoice?.run({
      node: node("WaitForChoice", { choiceALabel: "A", choiceBLabel: "B" }),
      inputs: { prompt: "Pick" },
      props: { choiceALabel: "A", choiceBLabel: "B" },
      graph,
      vars: {},
    });
    expect(choiceResult?.latent?.kind).toBe("choice");
    const choiceDefault = waitChoice?.run({
      node: node("WaitForChoice"),
      inputs: { prompt: "Pick" },
      props: {},
      graph,
      vars: {},
    });
    expect(choiceDefault?.viewModel?.choices.length).toBe(2);
    const choiceMissingPrompt = waitChoice?.run({
      node: node("WaitForChoice"),
      inputs: {},
      props: {},
      graph,
      vars: {},
    });
    expect(choiceMissingPrompt?.viewModel?.body).toBe("");
    const delayResult = delay?.run({
      node: node("Delay"),
      inputs: { ms: 10 },
      props: {},
      graph,
      vars: {},
    });
    expect(delayResult?.latent?.kind).toBe("delay");
    const delayDefault = delay?.run({
      node: node("Delay"),
      inputs: {},
      props: {},
      graph,
      vars: {},
    });
    expect(delayDefault?.viewModel?.body).toContain("0");
  });

  it("runs conversion and arithmetic nodes", () => {
    const toNumber = registry.get("ToNumber", 1);
    const divide = registry.get("Divide", 1);
    const converted = toNumber?.run({
      node: node("ToNumber"),
      inputs: { value: "2" },
      props: {},
      graph,
      vars: {},
    });
    expect(converted?.data.number).toBe(2);
    const result = divide?.run({
      node: node("Divide"),
      inputs: { a: 4, b: 2 },
      props: {},
      graph,
      vars: {},
    });
    expect(result?.data.result).toBe(2);
    expect(() =>
      divide?.run({
        node: node("Divide"),
        inputs: {},
        props: {},
        graph,
        vars: {},
      })
    ).toThrow();
  });

  it("throws on conversion errors", () => {
    const toNumber = registry.get("ToNumber", 1);
    expect(() =>
      toNumber?.run({
        node: node("ToNumber"),
        inputs: { value: "nope" },
        props: {},
        graph,
        vars: {},
      })
    ).toThrow();
  });

  it("throws on divide by zero", () => {
    const divide = registry.get("Divide", 1);
    expect(() =>
      divide?.run({
        node: node("Divide"),
        inputs: { a: 4, b: 0 },
        props: {},
        graph,
        vars: {},
      })
    ).toThrow();
  });

  it("runs subgraph node", () => {
    const subgraph = registry.get("Subgraph", 1);
    const result = subgraph?.run({
      node: node("Subgraph", { subgraphId: "sg" }),
      inputs: {},
      props: { subgraphId: "sg" },
      graph,
      vars: {},
    });
    expect(result?.subgraph?.graphId).toBe("sg");
    const fallback = subgraph?.run({
      node: node("Subgraph"),
      inputs: {},
      props: {},
      graph,
      vars: {},
    });
    expect(fallback?.subgraph?.graphId).toBe("");
  });
});
