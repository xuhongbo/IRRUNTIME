// 文件说明：自动补充文件级注释，描述模块职责与用途

// 写变量节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 写变量节点定义
export const SetVarNode: GameNodeDefinition = {
  type: 'vars.set',
  version: 1,
  category: '变量',
  title: '设置变量',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'value', type: 'any', label: '值' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'name', type: 'string', label: '变量名' },
    { name: 'value', type: 'string', label: '默认值' } 
  ],
  execute: async (ctx) => {
    const name = ctx.getProperty('name');
    let value = await ctx.getInput('value');
    if (value === undefined) {
      value = ctx.getProperty('value');
    }

    if (name) {
      ctx.scope.set(name, value);
    }
    
    return { nextExec: 'exec' };
  }
};
