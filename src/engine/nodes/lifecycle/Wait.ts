// 文件说明：自动补充文件级注释，描述模块职责与用途

// 等待节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 等待节点定义
export const WaitNode: GameNodeDefinition = {
  type: 'lifecycle.wait',
  version: 1,
  category: '生命周期',
  title: '等待',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'duration', type: 'number', label: '时长（毫秒）' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'duration', type: 'number', label: '时长（毫秒）', default: 1000 }
  ],
  execute: async (ctx) => {
    let duration = await ctx.getInput('duration');
    if (duration === undefined) duration = ctx.getProperty('duration');
    
    return {
      latent: new Promise((resolve) => {
        setTimeout(() => {
          resolve({ nextExec: 'exec' });
        }, Number(duration));
      })
    };
  }
};
