// 文件说明：自动补充文件级注释，描述模块职责与用途

// 读变量节点（旧版）
import { GameNodeDefinition } from "../../core/Node";

// 读变量节点定义
export const GetVarNode: GameNodeDefinition = {
  type: 'vars.get',
  version: 1,
  category: 'Variables',
  title: 'Get Variable',
  inputs: [],
  outputs: [
    { name: 'value', type: 'any', label: 'Value' }
  ],
  properties: [
    { name: 'name', type: 'string', label: 'Variable Name' }
  ],
  execute: async (ctx) => {
    const name = ctx.getProperty('name');
    const value = ctx.scope.get(name);
    return { outputs: { value } };
  }
};
