// 运行接口封装：对外提供统一执行入口
import type { Graph } from "./ir";
import type { Registry } from "./registry";
import { GraphRunner, type RuntimeStatus, type TraceEntry } from "./runtime";

export type RunOptions = {
  inputs: Record<string, unknown>;
  presetId?: string;
  seed?: number;
};

export type RunResultSnapshot = {
  outputs: Record<string, unknown>;
  trace: TraceEntry[];
  errors: string[];
  status: RuntimeStatus;
};

// 运行图：一次性执行到结束或错误
export const runGraph = (graph: Graph, registry: Registry, options: RunOptions): RunResultSnapshot => {
  const runtime = new GraphRunner(graph, registry);
  runtime.prepareRun(options);
  runtime.run();
  const snapshot = runtime.getSnapshot();
  return {
    outputs: snapshot.outputs,
    trace: snapshot.trace,
    errors: snapshot.errors,
    status: snapshot.status,
  };
};

// 单步执行：执行一步后返回快照
export const stepGraph = (graph: Graph, registry: Registry, options: RunOptions): RunResultSnapshot => {
  const runtime = new GraphRunner(graph, registry);
  runtime.prepareRun(options);
  runtime.step();
  const snapshot = runtime.getSnapshot();
  return {
    outputs: snapshot.outputs,
    trace: snapshot.trace,
    errors: snapshot.errors,
    status: snapshot.status,
  };
};

// 重置图：用于清理运行状态后获取快照
export const resetGraph = (graph: Graph, registry: Registry, options: RunOptions): RunResultSnapshot => {
  const runtime = new GraphRunner(graph, registry);
  runtime.prepareRun(options);
  runtime.reset();
  const snapshot = runtime.getSnapshot();
  return {
    outputs: snapshot.outputs,
    trace: snapshot.trace,
    errors: snapshot.errors,
    status: snapshot.status,
  };
};
