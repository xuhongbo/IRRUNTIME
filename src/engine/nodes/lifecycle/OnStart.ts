// 文件说明：自动补充文件级注释，描述模块职责与用途

// 启动事件节点（旧版）
import { GameNodeDefinition, NodeExecutionResult } from "../../core/Node";

// 启动事件节点定义
export const OnStartNode: GameNodeDefinition = {
  type: 'lifecycle.onStart',
  version: 1,
  category: 'Events',
  title: 'On Start',
  description: 'Triggered when the game starts.',
  inputs: [],
  outputs: [
    { name: 'exec', type: 'exec', label: 'Start' }
  ],
  properties: [],
  execute: async () => {
    return { nextExec: 'exec' };
  }
};
