// 文件说明：自动补充文件级注释，描述模块职责与用途

// 运行时 Hook：创建运行引擎并同步状态机
import { useEffect, useMemo } from "react";
import { useMachine } from "@xstate/react";
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { GraphRuntime } from "../engine/runtime";
import { createRuntimeMachine } from "../studio/runtimeMachine";

// 使用运行时：返回引擎、快照与发送事件方法
export const useRuntime = (graph: Graph, registry: Registry) => {
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("runtime:init");
    }
  }
  // 运行引擎实例（注册表变化时重建）
  const runtime = useMemo(() => new GraphRuntime(graph, registry), [registry]);
  const runtimeMachine = useMemo(() => createRuntimeMachine(runtime), [runtime]);
  const [state, send] = useMachine(runtimeMachine);
  const snapshot = state.context.snapshot;

  // 订阅运行时快照变更
  useEffect(() => {
    const unsubscribe = runtime.subscribe((next) => send({ type: "RUNTIME_UPDATED", snapshot: next }));
    return () => {
      unsubscribe();
    };
  }, [runtime, send]);

  // 图变化时更新运行引擎
  useEffect(() => {
    send({ type: "SET_GRAPH", graph });
  }, [graph, send]);

  return { runtime, snapshot, send };
};
