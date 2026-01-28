import { GameNodeDefinition } from "../../core/Node";

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
