// 文件说明：自动补充文件级注释，描述模块职责与用途

// 轨迹格式化工具
import type { RunMeta, TraceEntry } from "../engine/runtime";

// 将轨迹与元信息格式化为 JSON
export const formatTraceJson = (runMeta: RunMeta, trace: TraceEntry[]) => {
  return JSON.stringify({ meta: runMeta, entries: trace }, null, 2);
};
