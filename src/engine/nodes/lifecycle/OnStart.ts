import { GameNodeDefinition, NodeExecutionResult } from "../../core/Node";

export const OnStartNode: GameNodeDefinition = {
  type: 'lifecycle.onStart',
  version: 1,
  category: 'Events',
  title: 'On Start',
  description: 'Triggered when the game starts.',
  inputs: [],
  outputs: [
    { name: 'exec', type: 'exec', label: 'Start' }
  ],
  properties: [],
  execute: async () => {
    return { nextExec: 'exec' };
  }
};
