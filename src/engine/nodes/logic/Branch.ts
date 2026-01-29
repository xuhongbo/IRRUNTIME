// 文件说明：自动补充文件级注释，描述模块职责与用途

// 分支节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 条件分支节点定义
export const IfNode: GameNodeDefinition = {
  type: 'logic.if',
  version: 1,
  category: 'Logic',
  title: 'If / Branch',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'condition', type: 'boolean', label: 'Condition' }
  ],
  outputs: [
    { name: 'true', type: 'exec', label: 'True' },
    { name: 'false', type: 'exec', label: 'False' }
  ],
  properties: [
     { name: 'condition', type: 'boolean', label: 'Default Condition', default: false }
  ],
  execute: async (ctx) => {
    let condition = await ctx.getInput('condition');
    if (condition === undefined) condition = ctx.getProperty('condition');
    
    return { nextExec: condition ? 'true' : 'false' };
  }
};
