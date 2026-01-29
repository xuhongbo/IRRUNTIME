// 文件说明：自动补充文件级注释，描述模块职责与用途

// 日志节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 日志节点定义
export const LogNode: GameNodeDefinition = {
  type: 'actions.log',
  version: 1,
  category: '调试',
  title: '日志消息',
  description: '输出一条日志消息到控制台。',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'message', type: 'string', label: '消息' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'message', type: 'string', label: '消息', default: '你好，世界' }
  ],
  execute: async (ctx) => {
    // Try to get input connection first, if not, use property
    let msg = await ctx.getInput('message');
    if (msg === undefined) {
      msg = ctx.getProperty('message');
    }
    
    console.log(`[GameLog]: ${msg}`);
    
    return { nextExec: 'exec' };
  }
};
