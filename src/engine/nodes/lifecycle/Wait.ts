import { GameNodeDefinition } from "../../core/Node";

export const WaitNode: GameNodeDefinition = {
  type: 'lifecycle.wait',
  version: 1,
  category: 'Lifecycle',
  title: 'Wait',
  inputs: [
    { name: 'exec', type: 'exec' },
    { name: 'duration', type: 'number', label: 'Duration (ms)' }
  ],
  outputs: [
    { name: 'exec', type: 'exec' }
  ],
  properties: [
    { name: 'duration', type: 'number', label: 'Duration (ms)', default: 1000 }
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
