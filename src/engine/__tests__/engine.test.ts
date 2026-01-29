// 文件说明：自动补充文件级注释，描述模块职责与用途

import { Graph, NodeInstance, Edge } from "../ir";
import { GraphRunner } from "../runtime/GraphRunner";
import { VariableScope } from "../runtime/Scope";
import { loadStandardNodes } from "../registry/Loader";

describe('Game Engine Runtime', () => {
  // Mock console.log
  let logSpy: jest.SpyInstance;

  beforeAll(() => {
    loadStandardNodes();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should execute a simple flow: Start -> SetVar -> Log -> GetVar -> Log', async () => {
    // 1. Build Graph
    const nodes: NodeInstance[] = [
      {
        id: 'start',
        type: 'lifecycle.onStart',
        version: 1,
        props: {},
        pos: { x: 0, y: 0 }
      },
      {
        id: 'set_score',
        type: 'vars.set',
        version: 1,
        props: { name: 'score', value: '100' }, 
        pos: { x: 100, y: 0 }
      },
      {
        id: 'log_init',
        type: 'actions.log',
        version: 1,
        props: { message: 'Init Done' },
        pos: { x: 200, y: 0 }
      },
      {
        id: 'get_score',
        type: 'vars.get',
        version: 1,
        props: { name: 'score' },
        pos: { x: 100, y: 100 }
      },
      {
        id: 'log_score',
        type: 'actions.log',
        version: 1,
        props: {}, 
        pos: { x: 300, y: 0 }
      }
    ];

    const edges: Edge[] = [
      // Flow: Start -> Set -> Log1 -> Log2
      { id: 'e1', from: { nodeId: 'start', pinKey: 'exec' }, to: { nodeId: 'set_score', pinKey: 'exec' } },
      { id: 'e2', from: { nodeId: 'set_score', pinKey: 'exec' }, to: { nodeId: 'log_init', pinKey: 'exec' } },
      { id: 'e3', from: { nodeId: 'log_init', pinKey: 'exec' }, to: { nodeId: 'log_score', pinKey: 'exec' } },
      
      // Data: GetScore.value -> Log2.message
      { id: 'e4', from: { nodeId: 'get_score', pinKey: 'value' }, to: { nodeId: 'log_score', pinKey: 'message' } }
    ];

    const graph: Graph = {
      id: 'test_graph',
      version: 1,
      entryNodeId: 'start',
      nodes,
      edges
    };

    // 2. Run
    const globalScope = new VariableScope();
    globalScope.set('score', '0'); // Pre-declare variable so SetVar updates this instance
    const runner = new GraphRunner(graph, globalScope);

    // Trigger Start Event
    runner.trigger({ type: 'lifecycle' as any, name: 'OnStart', payload: {} });

    // Wait for execution (simple delay for now, ideally we hook into runner events)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. Verify
    // Expect Log 1: "Init Done"
    // Expect Log 2: "100" (from variable)
    
    // Check calls
    // console.log calls might include [GameLog]: prefix
    const calls = logSpy.mock.calls.map(args => args[0]);
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('Init Done'),
      expect.stringContaining('100')
    ]));
    
    // Verify variable scope
    expect(globalScope.get('score')).toBe('100');
  });
});