import { GameNodeDefinition } from "../../core/Node";

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
