// 文件说明：自动补充文件级注释，描述模块职责与用途

// 数学节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 加法节点定义
export const AddNode: GameNodeDefinition = {
  type: 'math.add',
  version: 1,
  category: 'Math',
  title: 'Add',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'a', type: 'number', label: 'A', default: 0 },
    { name: 'b', type: 'number', label: 'B', default: 0 }
  ],
  outputs: [
    { name: 'exec', type: 'exec' },
    { name: 'result', type: 'number', label: 'Result' }
  ],
  properties: [
    { name: 'a', type: 'number', label: 'Default A', default: 0 },
    { name: 'b', type: 'number', label: 'Default B', default: 0 }
  ],
  execute: async (ctx) => {
    let a = await ctx.getInput('a');
    if (a === undefined) a = ctx.getProperty('a');
    
    let b = await ctx.getInput('b');
    if (b === undefined) b = ctx.getProperty('b');
    
    return { 
      nextExec: 'exec',
      outputs: { result: Number(a) + Number(b) }
    };
  }
};
