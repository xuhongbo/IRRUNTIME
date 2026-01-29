// 文件说明：自动补充文件级注释，描述模块职责与用途

// 运行时状态机：包装运行引擎并提供事件式接口
import { assign, createMachine } from "xstate";
import type { Graph } from "../engine/ir";
import type { GraphRuntime, RuntimeSnapshot } from "../engine/runtime";

// 运行时事件：控制执行、重置与断点
export type RuntimeEvent =
  | { type: "RUN_WITH_INPUTS"; inputs: Record<string, unknown>; presetId?: string; seed?: number }
  | { type: "STEP_WITH_INPUTS"; inputs: Record<string, unknown>; presetId?: string; seed?: number }
  | { type: "RESET" }
  | { type: "NEXT" }
  | { type: "CHOOSE"; choiceKey: string }
  | { type: "TOGGLE_BREAKPOINT"; nodeId: string }
  | { type: "RUNTIME_UPDATED"; snapshot: RuntimeSnapshot }
  | { type: "SET_GRAPH"; graph: Graph };

// 运行时上下文：包含引擎实例与快照
export type RuntimeContext = {
  runtime: GraphRuntime;
  snapshot: RuntimeSnapshot;
};

// 创建运行时状态机
export const createRuntimeMachine = (runtime: GraphRuntime) =>
  createMachine<RuntimeContext, RuntimeEvent>(
    {
      id: "runtime",
      initial: "active",
      context: {
        runtime,
        snapshot: runtime.getSnapshot(),
      },
      states: {
        active: {
          on: {
            RUN_WITH_INPUTS: { actions: "runWithInputs" },
            STEP_WITH_INPUTS: { actions: "stepWithInputs" },
            RESET: { actions: "reset" },
            NEXT: { actions: "next" },
            CHOOSE: { actions: "choose" },
            TOGGLE_BREAKPOINT: { actions: "toggleBreakpoint" },
            RUNTIME_UPDATED: { actions: "setSnapshot" },
            SET_GRAPH: { actions: "setGraph" },
          },
        },
      },
    },
    {
      actions: {
        runWithInputs: ({ context, event }) => {
          const payload = event as Extract<RuntimeEvent, { type: "RUN_WITH_INPUTS" }>;
          context.runtime.prepareRun({
            inputs: payload.inputs,
            presetId: payload.presetId,
            seed: payload.seed,
          });
          context.runtime.run();
        },
        stepWithInputs: ({ context, event }) => {
          const payload = event as Extract<RuntimeEvent, { type: "STEP_WITH_INPUTS" }>;
          context.runtime.prepareRun({
            inputs: payload.inputs,
            presetId: payload.presetId,
            seed: payload.seed,
          });
          context.runtime.step();
        },
        reset: ({ context }) => context.runtime.reset(),
        next: ({ context }) => context.runtime.dispatchNext(),
        choose: ({ context, event }) => {
          const payload = event as Extract<RuntimeEvent, { type: "CHOOSE" }>;
          context.runtime.dispatchChoice(payload.choiceKey);
        },
        toggleBreakpoint: ({ context, event }) => {
          const payload = event as Extract<RuntimeEvent, { type: "TOGGLE_BREAKPOINT" }>;
          context.runtime.toggleBreakpoint(payload.nodeId);
        },
        setSnapshot: assign({
          snapshot: ({ event }) => {
            const payload = event as Extract<RuntimeEvent, { type: "RUNTIME_UPDATED" }>;
            return payload.snapshot;
          },
        }),
        setGraph: ({ context, event }) => {
          const payload = event as Extract<RuntimeEvent, { type: "SET_GRAPH" }>;
          context.runtime.setGraph(payload.graph);
        },
      },
    }
  );
