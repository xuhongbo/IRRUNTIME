// 文件说明：自动补充文件级注释，描述模块职责与用途

// 日志节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 日志节点定义
export const LogNode: GameNodeDefinition = {
  type: 'actions.log',
  version: 1,
  category: 'Debugging',
  title: 'Log Message',
  description: 'Prints a message to the console.',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'message', type: 'string', label: 'Message' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'message', type: 'string', label: 'Message', default: 'Hello World' }
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
