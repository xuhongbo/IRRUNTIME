import { GraphRuntime } from "../runtime";
import type { Graph } from "../ir";
import { registry } from "../registry";
import type { Registry } from "../registry";
import { z } from "zod";

const pos = { x: 0, y: 0 };

const node = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  version = 1
): Graph["nodes"][number] => ({
  id,
  type,
  version,
  props,
  pos,
});

const graph = (
  nodes: Graph["nodes"],
  edges: Graph["edges"],
  entry = nodes[0]?.id ?? "",
  contract?: Graph["contract"]
): Graph => ({
  id: "g",
  version: 1,
  entryNodeId: entry,
  nodes,
  edges,
  contract,
});

describe("GraphRuntime", () => {
  it("notifies subscribers", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    const snapshots: string[] = [];
    const unsubscribe = runtime.subscribe((snap) => {
      snapshots.push(snap.status);
    });
    runtime.run();
    unsubscribe();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("runs to a latent next and continues on dispatchNext", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("const", "ConstString", { value: "Hi" }),
        node("show", "ShowText", { title: "T" }, 2),
        node("end", "End"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const", pinKey: "in" } },
        { id: "e2", from: { nodeId: "const", pinKey: "out" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "e3", from: { nodeId: "show", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "const", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const waiting = runtime.getSnapshot();
    expect(waiting.status).toBe("waiting");
    expect(waiting.viewModel?.kind).toBe("text");
    runtime.dispatchNext();
    const finished = runtime.getSnapshot();
    expect(finished.status).toBe("finished");
  });

  it("finishes when entry is empty", () => {
    const g = graph([], [], "");
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("finished");
  });

  it("waits for choice and dispatchChoice continues", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("prompt", "ConstString", { value: "Pick" }),
        node("wait", "WaitForChoice", { choiceALabel: "A", choiceBLabel: "B" }),
        node("end", "End"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "prompt", pinKey: "in" } },
        { id: "e2", from: { nodeId: "prompt", pinKey: "out" }, to: { nodeId: "wait", pinKey: "in" } },
        { id: "e3", from: { nodeId: "wait", pinKey: "choiceA" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "prompt", pinKey: "value" }, to: { nodeId: "wait", pinKey: "prompt" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("waiting");
    runtime.dispatchChoice("choiceA");
    expect(runtime.getSnapshot().status).toBe("finished");
  });

  it("fails on invalid choice selection", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("prompt", "ConstString", { value: "Pick" }),
        node("wait", "WaitForChoice", { choiceALabel: "A", choiceBLabel: "B" }),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "prompt", pinKey: "in" } },
        { id: "e2", from: { nodeId: "prompt", pinKey: "out" }, to: { nodeId: "wait", pinKey: "in" } },
        { id: "d1", from: { nodeId: "prompt", pinKey: "value" }, to: { nodeId: "wait", pinKey: "prompt" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    runtime.dispatchChoice("nope");
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.errors.some((err) => err.includes("Invalid choice"))).toBe(true);
  });

  it("handles delay latent and resumes after timer", () => {
    jest.useFakeTimers();
    const g = graph(
      [
        node("start", "Start"),
        node("ms", "ConstNumber", { value: 50 }),
        node("delay", "Delay"),
        node("end", "End"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "ms", pinKey: "in" } },
        { id: "e2", from: { nodeId: "ms", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
        { id: "e3", from: { nodeId: "delay", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "ms", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("waiting");
    jest.runOnlyPendingTimers();
    expect(runtime.getSnapshot().status).toBe("finished");
    jest.useRealTimers();
  });

  it("ignores run while waiting", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("ms", "ConstNumber", { value: 100 }),
        node("delay", "Delay"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "ms", pinKey: "in" } },
        { id: "e2", from: { nodeId: "ms", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
        { id: "d1", from: { nodeId: "ms", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const waiting = runtime.getSnapshot().status;
    runtime.run();
    expect(runtime.getSnapshot().status).toBe(waiting);
  });

  it("ignores run and step when finished or error", () => {
    const g = graph([node("start", "Start"), node("end", "End")], [
      { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } },
    ]);
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("finished");
    runtime.run();
    runtime.step();
    expect(runtime.getSnapshot().status).toBe("finished");
  });

  it("ignores run when already errored", () => {
    const g = graph(
      [node("start", "Start"), node("show", "ShowText", { title: "T" }, 2)],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } }]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("error");
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("ignores dispatchers when no pending", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    runtime.dispatchNext();
    runtime.dispatchChoice("choiceA");
    expect(runtime.getSnapshot().status).toBe("idle");
  });

  it("reset cancels pending delay", () => {
    jest.useFakeTimers();
    const g = graph(
      [
        node("start", "Start"),
        node("ms", "ConstNumber", { value: 100 }),
        node("delay", "Delay"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "ms", pinKey: "in" } },
        { id: "e2", from: { nodeId: "ms", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
        { id: "d1", from: { nodeId: "ms", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("waiting");
    runtime.reset();
    jest.runOnlyPendingTimers();
    expect(runtime.getSnapshot().status).toBe("idle");
    jest.useRealTimers();
  });

  it("routes onError when node throws", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("a", "ConstNumber", { value: 4 }),
        node("b", "ConstNumber", { value: 0 }),
        node("divide", "Divide"),
        node("end", "End"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "a", pinKey: "in" } },
        { id: "e2", from: { nodeId: "a", pinKey: "out" }, to: { nodeId: "b", pinKey: "in" } },
        { id: "e3", from: { nodeId: "b", pinKey: "out" }, to: { nodeId: "divide", pinKey: "in" } },
        { id: "e4", from: { nodeId: "divide", pinKey: "onError" }, to: { nodeId: "end", pinKey: "in" } },
        { id: "d1", from: { nodeId: "a", pinKey: "value" }, to: { nodeId: "divide", pinKey: "a" } },
        { id: "d2", from: { nodeId: "b", pinKey: "value" }, to: { nodeId: "divide", pinKey: "b" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("finished");
    expect(snapshot.errors.length).toBe(0);
  });

  it("fails when required input is missing", () => {
    const g = graph(
      [node("start", "Start"), node("show", "ShowText", { title: "T" }, 2)],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } }]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.viewModel?.kind).toBe("error");
  });

  it("fails when upstream data is missing", () => {
    const g = graph(
      [
        node("start", "Start"),
        node("const", "ConstString", { value: "Hi" }),
        node("show", "ShowText", { title: "T" }, 2),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "show", pinKey: "in" } },
        { id: "d1", from: { nodeId: "const", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("handles non-Error throws in nodes", () => {
    const customRegistry: Registry = {
      get: () => ({
        type: "Thrower",
        version: 1,
        title: "Thrower",
        description: "",
        inputs: [],
        outputs: [],
        propsSchema: z.object({}).strict(),
        defaultProps: {},
        form: [],
        run: () => {
          throw "boom";
        },
      }),
      getLatest: () => null,
      listTypes: () => [],
      migrateGraph: (graphValue: Graph) => ({ graph: graphValue, migrations: [] }),
    };
    const g = graph([node("n1", "Thrower")], []);
    const runtime = new GraphRuntime(g, customRegistry);
    runtime.run();
    expect(runtime.getSnapshot().errors[0]).toBe("boom");
  });

  it("fails when definition is missing", () => {
    const g = graph(
      [node("start", "Start"), node("bad", "Unknown")],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "bad", pinKey: "in" } }]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.errors.some((err) => err.includes("Definition not found"))).toBe(true);
  });

  it("pauses when breakpoint hit inside execute", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    runtime.toggleBreakpoint("start");
    const internal = runtime as unknown as { executeCurrentNode: (ignore: boolean) => boolean };
    internal.executeCurrentNode(false);
    expect(runtime.getSnapshot().status).toBe("paused");
  });

  it("fails when graph context is missing", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    const internal = runtime as unknown as {
      executeCurrentNode: (ignore: boolean) => boolean;
      currentGraphId: string;
    };
    internal.currentGraphId = "missing";
    internal.executeCurrentNode(true);
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("fails when node is missing", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    const internal = runtime as unknown as {
      executeCurrentNode: (ignore: boolean) => boolean;
      currentNodeId: string | null;
    };
    internal.currentNodeId = "missing";
    internal.executeCurrentNode(true);
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("fails when advanceFromNode has missing graph context", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    const internal = runtime as unknown as {
      advanceFromNode: (
        nodeId: string,
        execKey: string | undefined,
        traceIndex: number,
        outputs: Record<string, unknown>
      ) => void;
      currentGraphId: string;
    };
    internal.currentGraphId = "missing";
    internal.advanceFromNode("start", "next", 0, {});
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("uses default values for data inputs", () => {
    const customRegistry: Registry = {
      get: () => ({
        type: "Default",
        version: 1,
        title: "Default",
        description: "",
        inputs: [{ key: "value", label: "Value", kind: "data", dataType: "number", defaultValue: 7 }],
        outputs: [],
        propsSchema: z.object({}).strict(),
        defaultProps: {},
        form: [],
        run: ({ inputs }: { inputs: Record<string, unknown> }) => ({ data: inputs }),
      }),
      getLatest: () => null,
      listTypes: () => [],
      migrateGraph: (graphValue: Graph) => ({ graph: graphValue, migrations: [] }),
    };
    const g = graph([node("n1", "Default")], []);
    const runtime = new GraphRuntime(g, customRegistry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.lastNodeIO["n1"]?.inputs.value).toBe(7);
  });

  it("fails when node returns no result", () => {
    const customRegistry: Registry = {
      get: () => ({
        type: "NullRun",
        version: 1,
        title: "NullRun",
        description: "",
        inputs: [],
        outputs: [],
        propsSchema: z.object({}).strict(),
        defaultProps: {},
        form: [],
        run: () => null,
      }),
      getLatest: () => null,
      listTypes: () => [],
      migrateGraph: (graphValue: Graph) => ({ graph: graphValue, migrations: [] }),
    };
    const g = graph([node("n1", "NullRun")], []);
    const runtime = new GraphRuntime(g, customRegistry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("error");
  });

  it("executes subgraph and returns to parent", () => {
    const g: Graph = {
      id: "root",
      version: 1,
      entryNodeId: "start",
      nodes: [
        node("start", "Start"),
        node("call", "Subgraph", { subgraphId: "sg" }),
        node("end", "End"),
      ],
      edges: [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "call", pinKey: "in" } },
        { id: "e2", from: { nodeId: "call", pinKey: "out" }, to: { nodeId: "end", pinKey: "in" } },
      ],
      subgraphs: {
        sg: {
          id: "sg",
          version: 1,
          entryNodeId: "sg-start",
          nodes: [
            node("sg-start", "Start"),
            node("sg-end", "End"),
          ],
          edges: [
            { id: "se1", from: { nodeId: "sg-start", pinKey: "next" }, to: { nodeId: "sg-end", pinKey: "in" } },
          ],
        },
      },
    };
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("finished");
  });

  it("fails when subgraph is missing", () => {
    const g = graph(
      [node("start", "Start"), node("call", "Subgraph", { subgraphId: "missing" })],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "call", pinKey: "in" } }]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.errors.some((err) => err.includes("Subgraph"))).toBe(true);
  });

  it("skips delay callback when pending cleared", () => {
    jest.useFakeTimers();
    const g = graph(
      [
        node("start", "Start"),
        node("ms", "ConstNumber", { value: 10 }),
        node("delay", "Delay"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "ms", pinKey: "in" } },
        { id: "e2", from: { nodeId: "ms", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
        { id: "d1", from: { nodeId: "ms", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const internal = runtime as unknown as { pending: unknown };
    internal.pending = null;
    jest.runOnlyPendingTimers();
    expect(runtime.getSnapshot().status).toBe("waiting");
    jest.useRealTimers();
  });

  it("skips delay callback when nodeId mismatches", () => {
    jest.useFakeTimers();
    const g = graph(
      [
        node("start", "Start"),
        node("ms", "ConstNumber", { value: 10 }),
        node("delay", "Delay"),
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "ms", pinKey: "in" } },
        { id: "e2", from: { nodeId: "ms", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
        { id: "d1", from: { nodeId: "ms", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
      ]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const internal = runtime as unknown as { pending: { kind: string; nodeId: string } | null };
    if (internal.pending && internal.pending.kind === "delay") {
      internal.pending = { ...internal.pending, nodeId: "other" };
    }
    jest.runOnlyPendingTimers();
    expect(runtime.getSnapshot().status).toBe("waiting");
    jest.useRealTimers();
  });

  it("honors breakpoints and step", () => {
    const g = graph(
      [node("start", "Start"), node("end", "End")],
      [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }]
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.toggleBreakpoint("start");
    runtime.run();
    expect(runtime.getSnapshot().status).toBe("paused");
    expect(runtime.getSnapshot().currentNodeId).toBe("start");
    runtime.step();
    expect(runtime.getSnapshot().status).toBe("paused");
    expect(runtime.getSnapshot().currentNodeId).toBe("end");
  });

  it("toggles breakpoint off", () => {
    const g = graph([node("start", "Start")], []);
    const runtime = new GraphRuntime(g, registry);
    runtime.toggleBreakpoint("start");
    runtime.toggleBreakpoint("start");
    expect(runtime.getSnapshot().breakpoints.length).toBe(0);
  });

  it("fails when step budget is exceeded", () => {
    const g = graph(
      [node("a", "ConstNumber"), node("b", "ConstNumber")],
      [
        { id: "e1", from: { nodeId: "a", pinKey: "out" }, to: { nodeId: "b", pinKey: "in" } },
        { id: "e2", from: { nodeId: "b", pinKey: "out" }, to: { nodeId: "a", pinKey: "in" } },
      ],
      "a"
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.status).toBe("error");
    expect(snapshot.errors.some((err) => err.includes("Step budget"))).toBe(true);
  });

  it("setGraph resets current graph state", () => {
    const g1 = graph([node("a", "Start")], []);
    const g2 = graph([node("b", "Start")], [], "b");
    const runtime = new GraphRuntime(g1, registry);
    runtime.run();
    runtime.setGraph(g2);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.currentNodeId).toBe("b");
    expect(snapshot.status).toBe("idle");
  });

  it("captures graph outputs from GraphOutput nodes", () => {
    const g = graph(
      [
        node("start", "Start"),
        { id: "input", type: "GraphInput", version: 1, props: { name: "name" }, pos },
        { id: "const", type: "ConstString", version: 1, props: { value: "hi" }, pos },
        { id: "out", type: "GraphOutput", version: 1, props: { name: "result" }, pos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const", pinKey: "in" } },
        { id: "e2", from: { nodeId: "const", pinKey: "out" }, to: { nodeId: "out", pinKey: "in" } },
        { id: "d1", from: { nodeId: "const", pinKey: "value" }, to: { nodeId: "out", pinKey: "value" } },
      ],
      "start",
      {
        inputs: [{ name: "name", type: "string" }],
        outputs: [{ name: "result", type: "string" }],
      }
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.setInputs({ name: "ignored" });
    runtime.run();
    const snapshot = runtime.getSnapshot();
    expect(snapshot.outputs.result).toBe("hi");
  });

  it("runWithInputs sets inputs before running", () => {
    const g = graph(
      [
        node("start", "Start"),
        { id: "const", type: "ConstString", version: 1, props: { value: "done" }, pos },
        { id: "out", type: "GraphOutput", version: 1, props: { name: "result" }, pos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const", pinKey: "in" } },
        { id: "e2", from: { nodeId: "const", pinKey: "out" }, to: { nodeId: "out", pinKey: "in" } },
        { id: "d1", from: { nodeId: "const", pinKey: "value" }, to: { nodeId: "out", pinKey: "value" } },
      ],
      "start",
      {
        inputs: [],
        outputs: [{ name: "result", type: "string" }],
      }
    );
    const runtime = new GraphRuntime(g, registry);
    const outputs = runtime.runWithInputs({});
    expect(outputs.result).toBe("done");
  });

  it("ignores GraphOutput without name", () => {
    const g = graph(
      [
        node("start", "Start"),
        { id: "const", type: "ConstString", version: 1, props: { value: "skip" }, pos },
        { id: "out", type: "GraphOutput", version: 1, props: { name: "" }, pos },
      ],
      [
        { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const", pinKey: "in" } },
        { id: "e2", from: { nodeId: "const", pinKey: "out" }, to: { nodeId: "out", pinKey: "in" } },
        { id: "d1", from: { nodeId: "const", pinKey: "value" }, to: { nodeId: "out", pinKey: "value" } },
      ],
      "start",
      {
        inputs: [],
        outputs: [],
      }
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.run();
    expect(runtime.getOutputs()).toEqual({});
  });

  it("seeds graph inputs only when name matches contract", () => {
    const g = graph(
      [
        node("start", "Start"),
        { id: "input", type: "GraphInput", version: 1, props: { name: "good" }, pos },
        { id: "input-bad", type: "GraphInput", version: 1, props: { name: 123 }, pos },
      ],
      [],
      "start",
      {
        inputs: [{ name: "good", type: "string" }],
        outputs: [],
      }
    );
    const runtime = new GraphRuntime(g, registry);
    runtime.setInputs({ good: "value" });
    const internal = runtime as unknown as { dataCache: Record<string, Record<string, unknown>> };
    expect(internal.dataCache.input?.value).toBe("value");
    expect(internal.dataCache["input-bad"]).toBeUndefined();
  });
});
