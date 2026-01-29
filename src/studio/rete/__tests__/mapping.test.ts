// 文件说明：自动补充文件级注释，描述模块职责与用途

import { ClassicPreset } from "rete";
import type { Graph } from "../../../engine/ir";
import { registry } from "../../../engine/registry";
import { applyCommand } from "../../commands";
import { buildReteConnection, buildReteNode, getSocketForPin, graphToRete, reteMoveCommand } from "../mapping";

const pos = { x: 0, y: 0 };

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos },
    { id: "end", type: "End", version: 1, props: {}, pos: { x: 100, y: 0 } },
  ],
  edges: [{ id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
};

describe("rete mapping", () => {
  it("maps pins to sockets", () => {
    const execPin = { key: "in", label: "In", kind: "exec" as const };
    const dataPin = { key: "value", label: "Value", kind: "data" as const, dataType: "string" as const };
    const jsonPin = { key: "payload", label: "Payload", kind: "data" as const };
    const execSocket = getSocketForPin(execPin);
    const dataSocket = getSocketForPin(dataPin);
    const jsonSocket = getSocketForPin(jsonPin);
    expect(execSocket).toBeInstanceOf(ClassicPreset.Socket);
    expect(dataSocket).toBeInstanceOf(ClassicPreset.Socket);
    expect(execSocket.name).toBe("exec");
    expect(dataSocket.name).toBe("string");
    expect(jsonSocket.name).toBe("json");
  });

  it("builds rete nodes with inputs and outputs", () => {
    const start = graph.nodes[0];
    const reteNode = buildReteNode(start, graph, registry);
    expect(reteNode.id).toBe("start");
    expect(reteNode.outputs.next).toBeDefined();
  });

  it("throws when definition is missing", () => {
    const badNode: Graph["nodes"][number] = {
      id: "bad",
      type: "Missing",
      version: 1,
      props: {},
      pos,
    };
    expect(() => buildReteNode(badNode, graph, registry)).toThrow();
  });

  it("builds rete connections", () => {
    const startNode = buildReteNode(graph.nodes[0], graph, registry);
    const endNode = buildReteNode(graph.nodes[1], graph, registry);
    const connection = buildReteConnection(graph.edges[0], startNode, endNode, true);
    expect(connection.id).toBe("e1");
    expect(connection.source).toBe("start");
    expect(connection.target).toBe("end");
  });

  it("maps graph to rete nodes and connections", () => {
    const result = graphToRete(graph, registry);
    expect(result.nodes.size).toBe(2);
    expect(result.connections.length).toBe(1);
    const connection = result.connections[0];
    expect(connection.source).toBe("start");
    expect(connection.target).toBe("end");
  });

  it("applies error buckets, focus, and runtime flags", () => {
    const errorMap = new Map([
      [
        "start",
        {
          nodeErrors: ["Missing input"],
          pinErrors: { next: ["Exec missing"] },
        },
      ],
    ]);
    const result = graphToRete(
      graph,
      registry,
      errorMap,
      { nodeId: "start", pinKey: "next" },
      "start",
      ["start"]
    );
    const startNode = result.nodes.get("start");
    expect(startNode?.nodeErrors).toEqual(["Missing input"]);
    expect(startNode?.pinErrors?.next).toEqual(["Exec missing"]);
    expect(startNode?.focusedPinKey).toBe("next");
    expect(startNode?.isRunning).toBe(true);
    expect(startNode?.hasBreakpoint).toBe(true);
  });

  it("skips edges with missing nodes", () => {
    const broken: Graph = {
      ...graph,
      edges: [{ id: "e2", from: { nodeId: "missing", pinKey: "next" }, to: { nodeId: "end", pinKey: "in" } }],
    };
    const result = graphToRete(broken, registry);
    expect(result.connections.length).toBe(0);
  });

  it("creates move commands and updates graph", () => {
    const cmd = reteMoveCommand("start", { x: 25, y: 40 });
    const next = applyCommand(graph, cmd);
    const moved = next.nodes.find((node) => node.id === "start");
    expect(moved?.pos).toEqual({ x: 25, y: 40 });
  });
});
