// 文件说明：自动补充文件级注释，描述模块职责与用途

// Rete 扩展类型定义
import type { NodeInstance } from "../../engine/ir";
import type { PinDef, Registry } from "../../engine/registry";

// Rete 节点数据：在节点实例基础上增加渲染信息
export type ReteNodeData = NodeInstance & {
  label: string;
  inputsMeta: PinDef[];
  outputsMeta: PinDef[];
  registry: Registry;
  nodeErrors: string[];
  pinErrors: Record<string, string[]>;
  focusedPinKey: string | null;
  isRunning: boolean;
  hasBreakpoint: boolean;
};

// Rete 连接数据：标识执行流连接
export type ReteConnectionData = {
  id: string;
  source: string;
  target: string;
  sourceOutput: string;
  targetInput: string;
  isExec: boolean;
};
