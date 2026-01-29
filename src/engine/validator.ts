// 文件说明：自动补充文件级注释，描述模块职责与用途

// 图结构校验：检测连线、端口、契约与节点属性
import type { Graph } from "./ir";
import type { PinDef, Registry } from "./registry";
import { findContractPort, hasDuplicateNames, normalizeContract, resolveNodeDefinition } from "./contract";

// 校验错误结构：用于界面提示
export type ValidationError = {
  nodeId?: string;
  pinId?: string;
  message: string;
  severity?: "error" | "warning";
};

// 数据类型是否可赋值（向 JSON 放宽）
export const isAssignable = (fromType: PinDef["dataType"], toType: PinDef["dataType"]) => {
  if (!fromType || !toType) return true;
  if (fromType === toType) return true;
  if (toType === "json") return true;
  return false;
};

// 检查默认值是否符合类型约束
const isValidDefaultValue = (dataType: PinDef["dataType"], value: unknown) => {
  if (value === undefined) return true;
  if (dataType === "json" || !dataType) return true;
  if (dataType === "string") return typeof value === "string";
  if (dataType === "number") return typeof value === "number" && Number.isFinite(value);
  if (dataType === "boolean") return typeof value === "boolean";
  return true;
};

// 校验图：返回错误列表与是否通过
export const validateGraph = (graph: Graph, registry: Registry) => {
  const errors: ValidationError[] = [];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const contract = normalizeContract(graph.contract);

  if (!nodeMap.has(graph.entryNodeId)) {
    errors.push({ message: "Entry node does not exist.", nodeId: graph.entryNodeId });
  }

  if (hasDuplicateNames(contract.inputs.map((item) => item.name))) {
    errors.push({ message: "Duplicate graph input name.", nodeId: graph.entryNodeId });
  }
  if (hasDuplicateNames(contract.outputs.map((item) => item.name))) {
    errors.push({ message: "Duplicate graph output name.", nodeId: graph.entryNodeId });
  }
  for (const input of contract.inputs) {
    if (!isValidDefaultValue(input.type, input.defaultValue)) {
      errors.push({
        message: `Contract input "${input.name}" defaultValue type mismatch.`,
        nodeId: graph.entryNodeId,
        severity: "error",
      });
    }
  }
  for (const output of contract.outputs) {
    if (!isValidDefaultValue(output.type, output.defaultValue)) {
      errors.push({
        message: `Contract output "${output.name}" defaultValue type mismatch.`,
        nodeId: graph.entryNodeId,
        severity: "error",
      });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({ message: "Duplicate edge id.", nodeId: edge.from.nodeId });
    }
    edgeIds.add(edge.id);
    const fromNode = nodeMap.get(edge.from.nodeId);
    const toNode = nodeMap.get(edge.to.nodeId);
    if (!fromNode) {
      errors.push({ message: "Edge source node missing.", nodeId: edge.from.nodeId, pinId: edge.from.pinKey, severity: "error" });
      continue;
    }
    if (!toNode) {
      errors.push({ message: "Edge target node missing.", nodeId: edge.to.nodeId, pinId: edge.to.pinKey, severity: "error" });
      continue;
    }
    const fromResolved = resolveNodeDefinition(fromNode, graph, registry);
    const toResolved = resolveNodeDefinition(toNode, graph, registry);
    if (!fromResolved) {
      errors.push({ message: "Unknown node type.", nodeId: fromNode.id, severity: "error" });
      continue;
    }
    if (!toResolved) {
      errors.push({ message: "Unknown node type.", nodeId: toNode.id, severity: "error" });
      continue;
    }
    const fromPin = fromResolved.outputs.find((pin) => pin.key === edge.from.pinKey);
    const toPin = toResolved.inputs.find((pin) => pin.key === edge.to.pinKey);
    if (!fromPin) {
      errors.push({ message: "Edge source pin missing.", nodeId: fromNode.id, pinId: edge.from.pinKey, severity: "error" });
      continue;
    }
    if (!toPin) {
      errors.push({ message: "Edge target pin missing.", nodeId: toNode.id, pinId: edge.to.pinKey, severity: "error" });
      continue;
    }
    if (fromPin.kind !== toPin.kind) {
      errors.push({
        message: "Edge connects incompatible pin kinds.",
        nodeId: toNode.id,
        pinId: edge.to.pinKey,
        severity: "error",
      });
      continue;
    }
    if (fromPin.kind === "data" && !isAssignable(fromPin.dataType, toPin.dataType)) {
      errors.push({
        message: "Edge connects incompatible data types.",
        nodeId: toNode.id,
        pinId: edge.to.pinKey,
        severity: "error",
      });
    }
  }

  const edgesByTo = new Map<string, Map<string, number>>();
  const edgesByFrom = new Map<string, Map<string, number>>();

  for (const edge of graph.edges) {
    if (!edgesByTo.has(edge.to.nodeId)) {
      edgesByTo.set(edge.to.nodeId, new Map());
    }
    if (!edgesByFrom.has(edge.from.nodeId)) {
      edgesByFrom.set(edge.from.nodeId, new Map());
    }
    const toMap = edgesByTo.get(edge.to.nodeId);
    const fromMap = edgesByFrom.get(edge.from.nodeId);
    if (toMap) {
      toMap.set(edge.to.pinKey, (toMap.get(edge.to.pinKey) ?? 0) + 1);
    }
    if (fromMap) {
      fromMap.set(edge.from.pinKey, (fromMap.get(edge.from.pinKey) ?? 0) + 1);
    }
  }

  for (const node of graph.nodes) {
    const resolved = resolveNodeDefinition(node, graph, registry);
    if (!resolved) {
      errors.push({ message: "Unknown node type.", nodeId: node.id, severity: "error" });
      continue;
    }
    const propsResult = resolved.def.propsSchema.safeParse(node.props);
    if (!propsResult.success) {
      errors.push({
        message: "Node props failed schema validation.",
        nodeId: node.id,
        severity: "error",
      });
    }
    const toMap = edgesByTo.get(node.id) ?? new Map();
    const fromMap = edgesByFrom.get(node.id) ?? new Map();

    for (const pin of resolved.inputs) {
      const incomingCount = toMap.get(pin.key) ?? 0;
      if (pin.kind === "data") {
        if (incomingCount > 1) {
          errors.push({
            message: "Data input has multiple incoming edges.",
            nodeId: node.id,
            pinId: pin.key,
            severity: "error",
          });
        }
        const hasEdge = incomingCount > 0;
        const hasDefault = pin.defaultValue !== undefined;
        if (pin.required && !hasEdge && !hasDefault) {
          errors.push({
            message: "Required input pin missing connection.",
            nodeId: node.id,
            pinId: pin.key,
            severity: "error",
          });
        }
      }
      if (pin.kind === "exec" && incomingCount > 1) {
        errors.push({
          message: "Exec input has multiple incoming edges.",
          nodeId: node.id,
          pinId: pin.key,
          severity: "error",
        });
      }
    }

    for (const pin of resolved.outputs) {
      if (pin.kind === "exec") {
        const count = fromMap.get(pin.key) ?? 0;
        if (count > 1) {
          errors.push({
            message: "Exec output has multiple outgoing edges.",
            nodeId: node.id,
            pinId: pin.key,
            severity: "error",
          });
        }
      }
    }

    // 执行路径死路检测：除 End 外必须有执行输出连线
    const hasExecPins =
      resolved.inputs.some((pin) => pin.kind === "exec") ||
      resolved.outputs.some((pin) => pin.kind === "exec");
    if (hasExecPins && node.type !== "End") {
      const outExec = resolved.outputs.filter((pin) => pin.kind === "exec");
      const hasOutExec = outExec.some((pin) => (fromMap.get(pin.key) ?? 0) > 0);
      if (!hasOutExec) {
        errors.push({
          message: "Exec path is dead-end.",
          nodeId: node.id,
          severity: "error",
        });
      }
    }
    if (hasExecPins && node.type !== "Start") {
      const inExec = resolved.inputs.filter((pin) => pin.kind === "exec");
      const hasInExec = inExec.some((pin) => (toMap.get(pin.key) ?? 0) > 0);
      if (!hasInExec) {
        errors.push({
          message: "Exec path has no incoming connection.",
          nodeId: node.id,
          severity: "error",
        });
      }
    }

    if (node.type === "GraphInput") {
      const name = typeof node.props.name === "string" ? node.props.name : "";
      if (!name || !findContractPort(graph, "inputs", name)) {
        errors.push({
          message: "Graph input name is not declared in contract.",
          nodeId: node.id,
          severity: "error",
        });
      }
    }

    if (node.type === "GraphOutput") {
      const name = typeof node.props.name === "string" ? node.props.name : "";
      if (!name || !findContractPort(graph, "outputs", name)) {
        errors.push({
          message: "Graph output name is not declared in contract.",
          nodeId: node.id,
          severity: "error",
        });
      }
    }

    if (node.type === "Subgraph") {
      const subgraphId = String(node.props.subgraphId ?? "");
      if (!subgraphId || !graph.subgraphs || !graph.subgraphs[subgraphId]) {
        errors.push({
          message: "Subgraph reference missing.",
          nodeId: node.id,
          severity: "error",
        });
      }
    }
  }

  for (const output of contract.outputs) {
    if (output.required === false) continue;
    const hasNode = graph.nodes.some(
      (node) => node.type === "GraphOutput" && node.props.name === output.name
    );
    if (!hasNode) {
      errors.push({
        message: `Graph output "${output.name}" is missing a GraphOutput node.`,
        nodeId: graph.entryNodeId,
        severity: "error",
      });
    }
  }

  return { ok: errors.length === 0, errors };
};
