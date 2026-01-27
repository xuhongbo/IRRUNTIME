import { createActor } from "xstate";
import type { GraphRuntime, RuntimeSnapshot } from "../../engine/runtime";
import { createRuntimeMachine } from "../runtimeMachine";

const baseSnapshot: RuntimeSnapshot = {
  status: "idle",
  currentNodeId: null,
  viewModel: null,
  trace: [],
  breakpoints: [],
  lastNodeIO: {},
  outputs: {},
  runMeta: {
    runId: 1,
    graphId: "g",
    graphVersion: 1,
    nodeVersions: {},
    inputsSnapshot: {},
    choices: [],
    seed: 0,
  },
  runId: 1,
  errors: [],
};

const makeRuntime = () => ({
  getSnapshot: jest.fn(() => baseSnapshot),
  prepareRun: jest.fn(),
  run: jest.fn(),
  step: jest.fn(),
  reset: jest.fn(),
  dispatchNext: jest.fn(),
  dispatchChoice: jest.fn(),
  toggleBreakpoint: jest.fn(),
  setGraph: jest.fn(),
});

describe("runtimeMachine", () => {
  it("drives runtime actions", () => {
    const runtime = makeRuntime() as unknown as GraphRuntime;
    const actor = createActor(createRuntimeMachine(runtime)).start();
    actor.send({ type: "RUN_WITH_INPUTS", inputs: { a: 1 }, presetId: "p1", seed: 2 });
    expect(runtime.prepareRun).toHaveBeenCalledWith({ inputs: { a: 1 }, presetId: "p1", seed: 2 });
    expect(runtime.run).toHaveBeenCalled();
    actor.send({ type: "STEP_WITH_INPUTS", inputs: { a: 2 } });
    expect(runtime.step).toHaveBeenCalled();
    actor.send({ type: "RESET" });
    expect(runtime.reset).toHaveBeenCalled();
    actor.send({ type: "NEXT" });
    expect(runtime.dispatchNext).toHaveBeenCalled();
    actor.send({ type: "CHOOSE", choiceKey: "a" });
    expect(runtime.dispatchChoice).toHaveBeenCalledWith("a");
    actor.send({ type: "TOGGLE_BREAKPOINT", nodeId: "n1" });
    expect(runtime.toggleBreakpoint).toHaveBeenCalledWith("n1");
  });

  it("updates snapshot and graph", () => {
    const runtime = makeRuntime() as unknown as GraphRuntime;
    const actor = createActor(createRuntimeMachine(runtime)).start();
    actor.send({ type: "RUNTIME_UPDATED", snapshot: { ...baseSnapshot, status: "running" } });
    expect(actor.getSnapshot().context.snapshot.status).toBe("running");
    actor.send({ type: "SET_GRAPH", graph: { id: "g2", version: 1, entryNodeId: "a", nodes: [], edges: [] } });
    expect(runtime.setGraph).toHaveBeenCalled();
  });
});
