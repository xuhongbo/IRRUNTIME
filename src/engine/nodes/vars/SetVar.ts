import { GameNodeDefinition } from "../../core/Node";

export const SetVarNode: GameNodeDefinition = {
  type: 'vars.set',
  version: 1,
  category: 'Variables',
  title: 'Set Variable',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'value', type: 'any', label: 'Value' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'name', type: 'string', label: 'Variable Name' },
    { name: 'value', type: 'string', label: 'Default Value' } 
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
