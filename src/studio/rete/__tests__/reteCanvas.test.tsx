import React from "react";
import { render } from "@testing-library/react";
import type { Graph } from "../../../engine/ir";
import { registry } from "../../../engine/registry";

const pipes: ((context: { type: string; data: { id: string } }) => unknown)[] = [];
const editorPipes: ((context: { type: string; data: { id: string } }) => unknown)[] = [];
let lastArea: { nodeViews: Map<string, { position: { x: number; y: number } }>; update: jest.Mock } | null = null;
let lastEditor: {
  addConnection: jest.Mock;
  removeNode: jest.Mock;
} | null = null;
let lastFlowParams: { canMakeConnection?: (from: unknown, to: unknown) => boolean; makeConnection?: (from: unknown, to: unknown, context: { editor: { addConnection: (conn: unknown) => void } }) => boolean } | null = null;
let lastSelectableOptions: { accumulating?: { active: (event: PointerEvent) => boolean } } | null = null;
let lastSelectableNodes: { select: jest.Mock; unselect: jest.Mock } | null = null;

jest.mock("rete", () => {
  class NodeEditor {
    private nodes = new Map<string, unknown>();
    private connections: { id: string }[] = [];
    addConnection = jest.fn(async (conn: { id: string }) => {
      this.connections.push(conn);
      return true;
    });
    removeConnection = jest.fn(async (id: string) => {
      this.connections = this.connections.filter((conn) => conn.id !== id);
      return true;
    });
    removeNode = jest.fn(async (id: string) => {
      this.nodes.delete(id);
      return true;
    });
    async addNode(node: { id: string }) {
      this.nodes.set(node.id, node);
      return true;
    }
    use() {
      return;
    }
    addPipe(pipe: (context: { type: string; data: { id: string } }) => unknown) {
      editorPipes.push(pipe);
    }
    getConnections() {
      return [...this.connections];
    }
    destroy() {
      return;
    }
    constructor() {
      lastEditor = this;
    }
  }
  return { NodeEditor };
});

jest.mock("rete-area-plugin", () => {
  class AreaPlugin {
    nodeViews = new Map<string, { position: { x: number; y: number } }>();
    update = jest.fn();
    constructor() {
      lastArea = this;
      return this;
    }
    use() {
      return;
    }
    addPipe(pipe: (context: { type: string; data: { id: string } }) => unknown) {
      pipes.push(pipe);
      return;
    }
    translate(id: string, pos: { x: number; y: number }) {
      this.nodeViews.set(id, { position: pos });
      return Promise.resolve(true);
    }
    destroy() {
      return;
    }
  }
  return {
    AreaPlugin,
    AreaExtensions: {
      selectableNodes: (_: unknown, __: unknown, options?: { accumulating?: { active: (event: PointerEvent) => boolean } }) => {
        lastSelectableOptions = options ?? null;
        lastSelectableNodes = {
          select: jest.fn().mockResolvedValue(undefined),
          unselect: jest.fn().mockResolvedValue(undefined),
        };
        return lastSelectableNodes;
      },
      selector: () => ({ entities: new Map(), unselectAll: () => Promise.resolve() }),
      accumulateOnCtrl: () => ({ active: () => false, destroy: () => undefined }),
    },
  };
});

jest.mock("rete-react-plugin", () => {
  class ReactPlugin {
    addPreset() {
      return;
    }
  }
  return {
    ReactPlugin,
    Presets: {
      classic: {
        setup: () => ({ render: () => null }),
      },
    },
  };
});

jest.mock("rete-connection-plugin", () => {
  let sourceTarget: [{ nodeId: string; key: string }, { nodeId: string; key: string }] | null = null;
  class ConnectionPlugin {
    addPreset(preset: () => unknown) {
      preset();
    }
    use() {
      return;
    }
  }
  class ClassicFlow {
    params: { canMakeConnection?: (from: unknown, to: unknown) => boolean; makeConnection?: (from: unknown, to: unknown, context: { editor: { addConnection: (conn: unknown) => void } }) => boolean };
    constructor(params: { canMakeConnection?: (from: unknown, to: unknown) => boolean; makeConnection?: (from: unknown, to: unknown, context: { editor: { addConnection: (conn: unknown) => void } }) => boolean } = {}) {
      this.params = params;
      lastFlowParams = params;
      return this;
    }
  }
  return {
    ConnectionPlugin,
    ClassicFlow,
    getSourceTarget: () => sourceTarget,
    __setSourceTarget: (value: typeof sourceTarget) => {
      sourceTarget = value;
    },
    __getLastFlowParams: () => lastFlowParams,
  };
});

let reteNodes = new Map([
  [
    "start",
    {
      id: "start",
      pos: { x: 10, y: 20 },
      label: "Start",
      inputsMeta: [],
      outputsMeta: [],
      nodeErrors: [],
      pinErrors: {},
      focusedPinKey: null,
      isRunning: false,
      hasBreakpoint: false,
    },
  ],
]);

jest.mock("../mapping", () => {
  return {
    graphToRete: () => ({
      nodes: reteNodes,
      connections: [],
    }),
    buildReteConnection: (edge: { id: string; from: { nodeId: string }; to: { nodeId: string } }) => ({
      id: edge.id,
      source: edge.from.nodeId,
      target: edge.to.nodeId,
    }),
    reteMoveCommand: (nodeId: string, pos: { x: number; y: number }) => ({
      type: "MOVE_NODE",
      nodeId,
      pos,
    }),
    __setReteNodes: (next: typeof reteNodes) => {
      reteNodes = next;
    },
  };
});

import {
  ReteCanvas,
  isBackgroundPointer,
  isDragLocked,
  isMultiSelectModifier,
  pruneDragLocks,
  selectionMatches,
  shouldSkipEditorPipe,
} from "../ReteCanvas";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [{ id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } }],
  edges: [],
};
const graphWithEnd: Graph = {
  ...graph,
  nodes: [
    ...graph.nodes,
    { id: "end", type: "End", version: 1, props: {}, pos: { x: 200, y: 0 } },
  ],
};
const graphWithEdge: Graph = {
  ...graphWithEnd,
  edges: [{ id: "edge-1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
};

describe("ReteCanvas", () => {
  it("logs debug info when enabled", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__ = true;
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    expect(infoSpy).toHaveBeenCalled();
    delete (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    infoSpy.mockRestore();
  });

  it("renders the canvas container", () => {
    pipes.length = 0;
    editorPipes.length = 0;
    lastArea = null;
    lastEditor = null;
    const { getByTestId } = render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    expect(getByTestId("canvas-root")).toBeInTheDocument();
  });

  it("clears selection when clicking background", () => {
    pipes.length = 0;
    editorPipes.length = 0;
    const onSelectNode = jest.fn();
    const onSelectNodes = jest.fn();
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={"start"}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={onSelectNode}
        onSelectNodes={onSelectNodes}
      />
    );
    const background = document.createElement("div");
    pipes.forEach((pipe) =>
      pipe({ type: "pointerdown", data: { event: { button: 0, target: background } } } as never)
    );
    expect(onSelectNode).toHaveBeenCalledWith(null);
    expect(onSelectNodes).toHaveBeenCalledWith([]);
  });

  it("detects multi-select modifier", () => {
    expect(isMultiSelectModifier({ ctrlKey: true })).toBe(true);
    expect(isMultiSelectModifier({ shiftKey: true })).toBe(true);
    expect(isMultiSelectModifier({ metaKey: true })).toBe(true);
    expect(isMultiSelectModifier({})).toBe(false);
  });

  it("detects background pointer", () => {
    const node = document.createElement("div");
    node.className = "rete-node";
    const child = document.createElement("span");
    node.appendChild(child);
    expect(isBackgroundPointer({ target: child })).toBe(false);
    expect(isBackgroundPointer({ target: document.createElement("div") })).toBe(true);
  });

  it("syncs selected node ids", async () => {
    pipes.length = 0;
    editorPipes.length = 0;
    lastSelectableNodes = null;
    await render(
      <ReteCanvas
        graph={graphWithEnd}
        registry={registry}
        selectedNodeId={"start"}
        selectedNodeIds={["start", "end"]}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastSelectableNodes?.select).toHaveBeenCalledWith("start", false);
    expect(lastSelectableNodes?.select).toHaveBeenCalledWith("end", true);
  });

  it("checks selection match", () => {
    const entities = new Map([
      ["a", {}],
      ["b", {}],
    ]);
    expect(selectionMatches(entities, ["a", "b"])).toBe(true);
    expect(selectionMatches(entities, ["a"])).toBe(false);
  });

  it("dispatches selection and move commands from pipes", () => {
    pipes.length = 0;
    editorPipes.length = 0;
    lastArea = null;
    lastEditor = null;
    const onCommand = jest.fn();
    const onSelectNode = jest.fn();
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={onSelectNode}
      />
    );
    expect(lastArea).toBeTruthy();
    if (lastArea) {
      lastArea.nodeViews.set("start", { position: { x: 42, y: 55 } });
    }
    const pipe = pipes[pipes.length - 1];
    pipe({ type: "nodepicked", data: { id: "start" } });
    pipe({ type: "nodedragged", data: { id: "start" } });
    expect(onSelectNode).toHaveBeenCalledWith("start");
    expect(onCommand).toHaveBeenCalledWith({ type: "MOVE_NODE", nodeId: "start", pos: { x: 40, y: 60 } });
  });

  it("suppresses drag commands during sync cooldown", async () => {
    pipes.length = 0;
    editorPipes.length = 0;
    lastArea = null;
    const onCommand = jest.fn();
    const onSelectNode = jest.fn();

    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        suppressDrag
        onCommand={onCommand}
        onSelectNode={onSelectNode}
      />
    );

    expect(lastArea).toBeTruthy();
    if (lastArea) {
      lastArea.nodeViews.set("start", { position: { x: 10, y: 12 } });
    }
    const pipe = pipes[pipes.length - 1];
    pipe({ type: "nodepicked", data: { id: "start" } });
    pipe({ type: "nodedragged", data: { id: "start" } });
    expect(onSelectNode).toHaveBeenCalledWith("start");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("notifies selection list when available", () => {
    pipes.length = 0;
    editorPipes.length = 0;
    const onCommand = jest.fn();
    const onSelectNode = jest.fn();
    const onSelectNodes = jest.fn();
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={onSelectNode}
        onSelectNodes={onSelectNodes}
      />
    );
    const pipe = pipes[pipes.length - 1];
    pipe({ type: "nodepicked", data: { id: "start" } });
    pipe({ type: "pointerup", data: { id: "start" } });
    expect(onSelectNodes).toHaveBeenCalled();
  });

  it("registers test api when enabled", () => {
    (window as unknown as { __RETE_TEST__?: boolean }).__RETE_TEST__ = true;
    pipes.length = 0;
    editorPipes.length = 0;
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    const api = (window as unknown as { __RETE_TEST_API__?: { connect?: () => void } }).__RETE_TEST_API__;
    expect(api?.connect).toBeDefined();
    (window as unknown as { __RETE_TEST__?: boolean }).__RETE_TEST__ = false;
  });

  it("skips editor pipe while syncing connections", () => {
    pipes.length = 0;
    editorPipes.length = 0;
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({ type: "connectionremoved", data: { id: "edge-1" } });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses timeout fallback when animation frame is unavailable", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = undefined as unknown as typeof window.requestAnimationFrame;
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.requestAnimationFrame = originalRaf;
    process.env.NODE_ENV = originalEnv;
  });

  it("uses animation frame when available in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const originalRaf = window.requestAnimationFrame;
    const rafSpy = jest.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.requestAnimationFrame = rafSpy as unknown as typeof window.requestAnimationFrame;

    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rafSpy).toHaveBeenCalled();
    window.requestAnimationFrame = originalRaf;
    process.env.NODE_ENV = originalEnv;
  });

  it("checks drag lock window", () => {
    const map = new Map<string, number>();
    map.set("n1", 1000);
    expect(isDragLocked(map, "n1", 1050, 100)).toBe(true);
    expect(isDragLocked(map, "n1", 1201, 100)).toBe(false);
    expect(isDragLocked(map, "n2", 1050, 100)).toBe(false);
  });

  it("prunes stale drag locks", () => {
    const map = new Map<string, number>();
    map.set("n1", 0);
    map.set("n2", 150);
    const removed = pruneDragLocks(map, 250, 100);
    expect(removed).toBe(1);
    expect(map.has("n1")).toBe(false);
    expect(map.has("n2")).toBe(true);
  });

  it("decides editor pipe skip reason", () => {
    expect(shouldSkipEditorPipe(true, false)).toBe("syncingConnections");
    expect(shouldSkipEditorPipe(false, true)).toBe("syncing");
    expect(shouldSkipEditorPipe(false, false)).toBeNull();
  });

  it("handles connection pipes and flow checks", async () => {
    pipes.length = 0;
    editorPipes.length = 0;
    lastFlowParams = null;
    lastEditor = null;
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graphWithEnd}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );

    const connectionMock = jest.requireMock("rete-connection-plugin") as {
      __setSourceTarget: (value: [{ nodeId: string; key: string }, { nodeId: string; key: string }] | null) => void;
      __getLastFlowParams: () => typeof lastFlowParams;
    };

    const flowParams = connectionMock.__getLastFlowParams();

    connectionMock.__setSourceTarget(null);
    expect(flowParams?.canMakeConnection?.({}, {})).toBe(false);
    expect(flowParams?.makeConnection?.({}, {}, { editor: { addConnection: jest.fn() } })).toBe(false);

    connectionMock.__setSourceTarget([{ nodeId: "start", key: "next" }, { nodeId: "start", key: "next" }]);
    expect(flowParams?.canMakeConnection?.({}, {})).toBe(false);
    expect(flowParams?.makeConnection?.({}, {}, { editor: { addConnection: jest.fn() } })).toBe(false);

    connectionMock.__setSourceTarget([{ nodeId: "start", key: "next" }, { nodeId: "end", key: "in" }]);
    const addConnection = jest.fn();
    expect(flowParams?.canMakeConnection?.({}, {})).toBe(true);
    expect(flowParams?.makeConnection?.({}, {}, { editor: { addConnection } })).toBe(true);
    expect(addConnection).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({ type: "connectioncreated", data: { id: "c1", source: "start", sourceOutput: "next", target: "end", targetInput: "in" } });
    expect(onCommand).toHaveBeenCalledWith({
      type: "CONNECT",
      edge: { id: "c1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } },
    });
  });

  it("syncs nodes across updates", () => {
    const mappingMock = jest.requireMock("../mapping") as { __setReteNodes: (nodes: typeof reteNodes) => void };
    mappingMock.__setReteNodes(
      new Map([
        [
          "start",
          {
            id: "start",
            pos: { x: 10, y: 20 },
            label: "Start",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: false,
            hasBreakpoint: false,
          },
        ],
        [
          "end",
          {
            id: "end",
            pos: { x: 80, y: 20 },
            label: "End",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: false,
            hasBreakpoint: false,
          },
        ],
      ])
    );
    const graphWithTwo: Graph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: "end", type: "End", version: 1, props: {}, pos: { x: 100, y: 0 } },
      ],
    };
    const { rerender } = render(
      <ReteCanvas
        graph={graphWithTwo}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    mappingMock.__setReteNodes(
      new Map([
        [
          "start",
          {
            id: "start",
            pos: { x: 10, y: 20 },
            label: "Start",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: true,
            hasBreakpoint: true,
          },
        ],
      ])
    );
    rerender(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    expect(lastEditor?.removeNode).toHaveBeenCalledWith("end");
    expect(lastArea?.update).toHaveBeenCalledWith("node", "start");
  });

  it("creates rete connections from graph edges", () => {
    const mappingMock = jest.requireMock("../mapping") as { __setReteNodes: (nodes: typeof reteNodes) => void };
    mappingMock.__setReteNodes(
      new Map([
        [
          "start",
          {
            id: "start",
            pos: { x: 10, y: 20 },
            label: "Start",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: false,
            hasBreakpoint: false,
          },
        ],
        [
          "end",
          {
            id: "end",
            pos: { x: 80, y: 20 },
            label: "End",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: false,
            hasBreakpoint: false,
          },
        ],
      ])
    );
    render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    expect(lastEditor?.addConnection).toHaveBeenCalled();
  });

  it("skips connections when source nodes are missing", () => {
    const mappingMock = jest.requireMock("../mapping") as { __setReteNodes: (nodes: typeof reteNodes) => void };
    mappingMock.__setReteNodes(
      new Map([
        [
          "start",
          {
            id: "start",
            pos: { x: 10, y: 20 },
            label: "Start",
            inputsMeta: [],
            outputsMeta: [],
            nodeErrors: [],
            pinErrors: {},
            focusedPinKey: null,
            isRunning: false,
            hasBreakpoint: false,
          },
        ],
      ])
    );
    render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    expect(lastEditor?.addConnection).not.toHaveBeenCalled();
  });

  it("ignores programmatic connection events during sync", () => {
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({
      type: "connectioncreated",
      data: { id: "edge-1", source: "start", sourceOutput: "next", target: "end", targetInput: "in" },
    });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches disconnect when an existing edge is removed", async () => {
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({ type: "connectionremoved", data: { id: "edge-1" } });
    expect(onCommand).toHaveBeenCalledWith({ type: "DISCONNECT", edgeId: "edge-1" });
  });

  it("ignores connectioncreated when edge already exists", async () => {
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({
      type: "connectioncreated",
      data: { id: "edge-2", source: "start", sourceOutput: "next", target: "end", targetInput: "in" },
    });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("ignores connectionremoved when edge is missing", async () => {
    const onCommand = jest.fn();
    render(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={onCommand}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pipe = editorPipes[editorPipes.length - 1];
    pipe({ type: "connectionremoved", data: { id: "missing" } });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("removes stale connections during sync", async () => {
    const { rerender } = render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await lastEditor?.addConnection({ id: "stale" });
    rerender(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastEditor?.removeConnection).toHaveBeenCalledWith("stale");
  });

  it("swallows remove connection errors during sync", async () => {
    const { rerender } = render(
      <ReteCanvas
        graph={graphWithEdge}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await lastEditor?.addConnection({ id: "stale" });
    lastEditor?.removeConnection.mockImplementationOnce(() => {
      throw new Error("failed");
    });
    rerender(
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={null}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onCommand={() => undefined}
        onSelectNode={() => undefined}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastEditor?.removeConnection).toHaveBeenCalled();
  });
});
