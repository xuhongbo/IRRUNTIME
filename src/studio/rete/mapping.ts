// 文件说明：自动补充文件级注释，描述模块职责与用途

// Rete 映射：在图结构与画布节点之间转换
import { ClassicPreset } from "rete";
import type { Graph } from "../../engine/ir";
import type { PinDef, Registry } from "../../engine/registry";
import { resolveNodeDefinition } from "../../engine/contract";
import type { Command } from "../commands";
import type { ErrorBucket } from "../errors";
import type { ReteConnectionData, ReteNodeData } from "./types";

// 执行流与数据类型套接字
const execSocket = new ClassicPreset.Socket("exec");
const dataSockets: Record<NonNullable<PinDef["dataType"]>, ClassicPreset.Socket> = {
  string: new ClassicPreset.Socket("string"),
  number: new ClassicPreset.Socket("number"),
  boolean: new ClassicPreset.Socket("boolean"),
  json: new ClassicPreset.Socket("json"),
};

// 获取端口对应的套接字
export const getSocketForPin = (pin: PinDef) => {
  if (pin.kind === "exec") return execSocket;
  if (pin.dataType && dataSockets[pin.dataType]) return dataSockets[pin.dataType];
  return dataSockets.json;
};

// 将图节点转换为 Rete 节点
export const buildReteNode = (node: Graph["nodes"][number], graph: Graph, registry: Registry) => {
  const resolved = resolveNodeDefinition(node, graph, registry);
  if (!resolved) {
    throw new Error(`Missing node definition for ${node.type}@${node.version}`);
  }
  const reteNode = new ClassicPreset.Node<ReteNodeData>(resolved.def.title ?? node.type);
  reteNode.id = node.id;
  Object.assign(reteNode, {
    ...node,
    label: resolved.def.title ?? node.type,
    inputsMeta: resolved.inputs,
    outputsMeta: resolved.outputs,
    registry,
    nodeErrors: [],
    pinErrors: {},
    focusedPinKey: null,
    isRunning: false,
    hasBreakpoint: false,
  });
  for (const input of resolved.inputs) {
    const socket = getSocketForPin(input);
    const inputPort = new ClassicPreset.Input(socket, input.label, input.kind === "exec" ? false : false);
    inputPort.id = input.key;
    reteNode.addInput(input.key, inputPort);
  }
  for (const output of resolved.outputs) {
    const socket = getSocketForPin(output);
    const outputPort = new ClassicPreset.Output(socket, output.label, output.kind !== "exec");
    outputPort.id = output.key;
    reteNode.addOutput(output.key, outputPort);
  }
  return reteNode;
};

// 构建 Rete 连接对象
export const buildReteConnection = (
  edge: Graph["edges"][number],
  sourceNode: ClassicPreset.Node,
  targetNode: ClassicPreset.Node,
  isExec: boolean
) => {
  const connection = new ClassicPreset.Connection(sourceNode, edge.from.pinKey, targetNode, edge.to.pinKey);
  connection.id = edge.id;
  (connection as unknown as ReteConnectionData).isExec = isExec;
  return connection;
};

// 将图结构转换为 Rete 节点与连线集合
export const graphToRete = (
  graph: Graph,
  registry: Registry,
  errorMap?: Map<string, ErrorBucket>,
  focusedPin?: { nodeId: string; pinKey: string } | null,
  runningNodeId?: string | null,
  breakpoints?: string[]
) => {
  const nodes = new Map<string, ClassicPreset.Node<ReteNodeData>>();
  const connections: ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>[] = [];

  for (const node of graph.nodes) {
    const reteNode = buildReteNode(node, graph, registry);
    const bucket = errorMap?.get(node.id);
    reteNode.nodeErrors = bucket?.nodeErrors ?? [];
    reteNode.pinErrors = bucket?.pinErrors ?? {};
    reteNode.focusedPinKey = focusedPin?.nodeId === node.id ? focusedPin.pinKey : null;
    reteNode.isRunning = runningNodeId === node.id;
    reteNode.hasBreakpoint = breakpoints?.includes(node.id) ?? false;
    nodes.set(node.id, reteNode);
  }

  for (const edge of graph.edges) {
    const sourceNode = nodes.get(edge.from.nodeId);
    const targetNode = nodes.get(edge.to.nodeId);
    if (!sourceNode || !targetNode) continue;
    const sourceGraphNode = graph.nodes.find((item) => item.id === edge.from.nodeId);
    const resolved = sourceGraphNode ? resolveNodeDefinition(sourceGraphNode, graph, registry) : null;
    const pin = resolved?.outputs.find((output) => output.key === edge.from.pinKey);
    const isExec = pin?.kind === "exec";
    connections.push(buildReteConnection(edge, sourceNode, targetNode, isExec));
  }

  return { nodes, connections };
};

export const reteMoveCommand = (nodeId: string, pos: { x: number; y: number }): Command => ({
  type: "MOVE_NODE",
  nodeId,
  pos,
});
