// 文件说明：自动补充文件级注释，描述模块职责与用途

// 运行时统一导出
export {
  GraphRunner,
  GraphRunner as GraphRuntime,
  type RuntimeSnapshot,
  type RuntimeStatus,
  type TraceEntry,
  type RunMeta,
} from "./runtime/GraphRunner";

export { runGraph, stepGraph, resetGraph, type RunOptions, type RunResultSnapshot } from "./runnerApi";
