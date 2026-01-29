// 文件说明：自动补充文件级注释，描述模块职责与用途

// 图运行时执行引擎：负责调度节点、记录轨迹与处理等待状态
import type { Graph, NodeIO } from "../ir";
import type { Registry, RunResult, NodeDefinition, LatentToken } from "../registry";
import type { ViewModel } from "../viewModel";
import { normalizeContract } from "../contract";

// 运行轨迹条目：记录一次节点执行的输入、输出与耗时
export type TraceEntry = {
  runId: number;
  seq: number;
  nodeId: string;
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  exec?: string;
  error?: string;
  logs?: string[];
};

// 运行状态枚举
export type RuntimeStatus = "idle" | "running" | "waiting" | "paused" | "error" | "finished";

// 运行时快照：提供给界面层渲染与调试
export type RuntimeSnapshot = {
  status: RuntimeStatus;
  currentNodeId: string | null;
  viewModel: ViewModel | null;
  trace: TraceEntry[];
  breakpoints: string[];
  lastNodeIO: Record<string, NodeIO>;
  outputs: Record<string, unknown>;
  vars: Record<string, unknown>;
  runMeta: RunMeta;
  runId: number;
  errors: string[];
};

// 本次运行元数据：用于追踪版本与输入
export type RunMeta = {
  runId: number;
  graphId: string;
  graphVersion: number;
  nodeVersions: Record<string, number>;
  presetId?: string;
  inputsSnapshot: Record<string, unknown>;
  choices: { nodeId: string; choiceKey: string }[];
  seed: number;
};

// 调用栈帧：用于子图返回
type GraphFrame = {
  graphId: string;
  returnTo: { nodeId: string; execKey: string | undefined } | null;
};

// 等待用户选择的挂起状态
type ChoicePending = {
  kind: "choice";
  nodeId: string;
  options: { key: string; label: string }[];
  execByChoice: Record<string, string>;
  outputsByChoice: Record<string, Record<string, unknown>>;
  traceIndex: number;
};

// 等待用户点击继续的挂起状态
type NextPending = {
  kind: "next";
  nodeId: string;
  resumeExec: string;
  traceIndex: number;
};

// 延迟等待挂起状态
type DelayPending = {
  kind: "delay";
  nodeId: string;
  resumeExec: string;
  ms: number;
  timerId: number | null;
  traceIndex: number;
};

// 异步脚本挂起状态
type DeferredPending = {
  kind: "deferred";
  nodeId: string;
  traceIndex: number;
  token: number;
};

// 运行时可能进入的挂起状态集合
type PendingLatent = ChoicePending | NextPending | DelayPending | DeferredPending;

// 图运行时上下文：缓存节点与边映射
type GraphContext = {
  graph: Graph;
  nodeMap: Map<string, Graph["nodes"][number]>;
  edgesByTo: Map<string, Map<string, Graph["edges"][number]>>;
  edgesByFrom: Map<string, Map<string, Graph["edges"][number]>>;
};

// 图运行引擎：以执行流边为主驱动节点执行
export class GraphRunner {
  private registry: Registry;
  private rootGraph: Graph;
  private currentGraphId: string;
  private graphStack: GraphFrame[] = [];
  private status: RuntimeStatus = "idle";
  private currentNodeId: string | null;
  private breakpoints = new Set<string>();
  private trace: TraceEntry[] = [];
  private lastNodeIO: Record<string, NodeIO> = {};
  private viewModel: ViewModel | null = null;
  private listeners = new Set<(snapshot: RuntimeSnapshot) => void>();
  private pending: PendingLatent | null = null;
  private vars: Record<string, unknown> = {};
  private dataCache: Record<string, Record<string, unknown>> = {};
  private graphInputs: Record<string, unknown> = {};
  private graphOutputs: Record<string, unknown> = {};
  private runMeta: RunMeta;
  private runId = 1;
  private seq = 0;
  private errors: string[] = [];
  private timers: number[] = [];
  private stepBudget = 800;
  private deferredToken = 0;

  // 创建运行引擎并初始化图与状态
  constructor(graph: Graph, registry: Registry) {
    this.rootGraph = graph;
    this.registry = registry;
    this.currentGraphId = graph.id;
    this.currentNodeId = graph.entryNodeId;
    this.runMeta = this.createRunMeta({});
  }

  // 订阅运行时快照变化
  subscribe(listener: (snapshot: RuntimeSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  // 获取当前快照（对外只读）
  getSnapshot(): RuntimeSnapshot {
    return {
      status: this.status,
      currentNodeId: this.currentNodeId,
      viewModel: this.viewModel,
      trace: [...this.trace],
      breakpoints: Array.from(this.breakpoints),
      lastNodeIO: { ...this.lastNodeIO },
      outputs: { ...this.graphOutputs },
      vars: { ...this.vars },
      runMeta: { ...this.runMeta },
      runId: this.runId,
      errors: [...this.errors],
    };
  }

  // 切换图并重置运行状态
  setGraph(graph: Graph) {
    this.rootGraph = graph;
    this.currentGraphId = graph.id;
    this.currentNodeId = graph.entryNodeId;
    this.graphStack = [];
    this.graphOutputs = {};
    this.seedGraphInputs();
    this.reset();
  }

  // 设置运行输入并同步元数据
  setInputs(inputs: Record<string, unknown>) {
    this.graphInputs = { ...inputs };
    this.runMeta = this.createRunMeta(inputs, this.runMeta.presetId, this.runMeta.seed);
    this.seedGraphInputs();
    this.emit();
  }

  // 准备一次运行：输入、预设与随机种子
  prepareRun(options: { inputs: Record<string, unknown>; presetId?: string; seed?: number }) {
    this.graphInputs = { ...options.inputs };
    this.runMeta = this.createRunMeta(options.inputs, options.presetId, options.seed);
    this.seedGraphInputs();
    this.emit();
  }

  // 重置运行状态与追踪数据
  reset() {
    this.clearLatent();
    this.status = "idle";
    this.currentGraphId = this.rootGraph.id;
    this.graphStack = [];
    this.currentNodeId = this.rootGraph.entryNodeId;
    this.trace = [];
    this.lastNodeIO = {};
    this.viewModel = null;
    this.vars = {};
    this.dataCache = {};
    this.errors = [];
    this.seq = 0;
    this.graphOutputs = {};
    this.runMeta = this.createRunMeta(this.graphInputs, this.runMeta.presetId, this.runMeta.seed);
    this.seedGraphInputs();
    this.runId += 1;
    this.emit();
  }

  // 切换断点
  toggleBreakpoint(nodeId: string) {
    if (this.breakpoints.has(nodeId)) {
      this.breakpoints.delete(nodeId);
    } else {
      this.breakpoints.add(nodeId);
    }
    this.emit();
  }

  // 批量设置断点
  setBreakpoints(breakpoints: string[]) {
    this.breakpoints = new Set(breakpoints);
    this.emit();
  }

  // 连续执行：直到完成、挂起或触发断点
  run() {
    if (this.status === "waiting") return;
    if (this.status === "finished" || this.status === "error") return;
    this.status = "running";
    let steps = 0;
    while (this.status === "running" && steps < this.stepBudget) {
      const shouldPause = this.currentNodeId && this.breakpoints.has(this.currentNodeId);
      if (shouldPause) {
        this.status = "paused";
        break;
      }
      const progressed = this.executeCurrentNode(false);
      if (!progressed) break;
      steps += 1;
    }
    if (steps >= this.stepBudget && this.status === "running") {
      this.failRuntime("Step budget exceeded. Possible infinite loop.");
    }
    this.emit();
  }

  // 便捷执行：设置输入并返回输出快照
  runWithInputs(inputs: Record<string, unknown>) {
    this.prepareRun({ inputs });
    this.run();
    return { ...this.graphOutputs };
  }

  // 获取图输出快照
  getOutputs() {
    return { ...this.graphOutputs };
  }

  // 单步执行：执行当前节点一次并暂停
  step() {
    if (this.status === "waiting") return;
    if (this.status === "finished" || this.status === "error") return;
    this.status = "running";
    this.executeCurrentNode(true);
    if (this.status === "running") {
      this.status = "paused";
    }
    this.emit();
  }

  // 在等待“继续”状态下推进执行
  dispatchNext() {
    if (!this.pending || this.pending.kind !== "next") return;
    const pending = this.pending;
    this.pending = null;
    this.status = "running";
    this.advanceFromNode(pending.nodeId, pending.resumeExec, pending.traceIndex, {});
    this.run();
  }

  // 在等待“选择”状态下推进执行
  dispatchChoice(choiceKey: string) {
    if (!this.pending || this.pending.kind !== "choice") return;
    const pending = this.pending;
    const execKey = pending.execByChoice[choiceKey];
    const outputs = pending.outputsByChoice[choiceKey] ?? {};
    if (!execKey) {
      this.failRuntime("Invalid choice selection.");
      return;
    }
    this.runMeta.choices.push({ nodeId: pending.nodeId, choiceKey });
    this.pending = null;
    this.status = "running";
    this.advanceFromNode(pending.nodeId, execKey, pending.traceIndex, outputs);
    this.run();
  }

  // 执行当前节点，返回是否继续推进
  private executeCurrentNode(ignoreBreakpoint: boolean) {
    if (!this.currentNodeId) {
      this.status = "finished";
      this.viewModel = { kind: "done", title: "Complete", body: "Graph finished." };
      return false;
    }
    if (!ignoreBreakpoint && this.breakpoints.has(this.currentNodeId)) {
      this.status = "paused";
      return false;
    }
    const graphCtx = this.getGraphContext(this.currentGraphId);
    if (!graphCtx) {
      this.failRuntime("Graph context not found.");
      return false;
    }
    const node = graphCtx.nodeMap.get(this.currentNodeId);
    if (!node) {
      this.failRuntime(`Node ${this.currentNodeId} not found.`);
      return false;
    }
    const def = this.getNodeDefinition(node);
    if (!def) {
      this.failRuntime(`Definition not found for ${node.type}@${node.version}.`);
      return false;
    }

    const startMs = performance.now();
    let inputs: Record<string, unknown> = {};
    let result: RunResult | null = null;
    let error: string | undefined;
    try {
      inputs = this.resolveInputs(graphCtx, node, def, new Set());
      result = def.run({
        node,
        inputs,
        props: node.props,
        graph: graphCtx.graph,
        vars: this.vars,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const endMs = performance.now();
    const durationMs = endMs - startMs;

    // 记录执行轨迹
    const traceEntry: TraceEntry = {
      runId: this.runId,
      seq: this.seq,
      nodeId: node.id,
      type: node.type,
      startMs,
      endMs,
      durationMs,
      inputs,
      outputs: result?.data ?? {},
      exec: result?.exec,
      error,
      logs: result?.logs,
    };
    const traceIndex = this.trace.length;
    this.trace.push(traceEntry);
    this.seq += 1;

    this.lastNodeIO[node.id] = {
      inputs,
      outputs: result?.data ?? {},
      durationMs,
      error,
      logs: result?.logs,
    };

    if (error) {
      this.handleNodeError(node, def, error, traceIndex);
      return true;
    }

    if (!result) {
      this.failRuntime("Node returned no result.");
      return false;
    }

    if (result.error) {
      this.handleNodeError(node, def, result.error, traceIndex);
      return true;
    }

    if (result.deferred) {
      const token = ++this.deferredToken;
      this.pending = { kind: "deferred", nodeId: node.id, traceIndex, token };
      this.status = "waiting";
      result.deferred
        .then((resolved) => {
          if (this.deferredToken !== token) return;
          this.pending = null;
          this.status = "running";
          const entry = this.trace[traceIndex];
          if (entry) {
            entry.outputs = resolved.data ?? {};
            entry.exec = resolved.exec;
            entry.error = resolved.error;
            entry.logs = resolved.logs;
          }
          this.lastNodeIO[node.id] = {
            inputs,
            outputs: resolved.data ?? {},
            durationMs: performance.now() - startMs,
            error: resolved.error,
            logs: resolved.logs,
          };
          if (resolved.error) {
            this.handleNodeError(node, def, resolved.error, traceIndex);
            this.emit();
            return;
          }
          if (resolved.viewModel) {
            this.viewModel = resolved.viewModel;
          }
          if (resolved.data) {
            this.dataCache[node.id] = resolved.data;
          }
          this.advanceFromNode(node.id, resolved.exec, traceIndex, resolved.data ?? {});
          this.run();
        })
        .catch((err) => {
          if (this.deferredToken !== token) return;
          this.pending = null;
          this.status = "running";
          this.handleNodeError(node, def, err instanceof Error ? err.message : String(err), traceIndex);
          this.emit();
        });
      return true;
    }

    if (result.viewModel) {
      this.viewModel = result.viewModel;
    }

    if (result.data) {
      this.dataCache[node.id] = result.data;
    }

    if (node.type === "GraphOutput") {
      const outputName = typeof node.props.name === "string" ? node.props.name : "";
      const value = result.data?.value;
      if (outputName) {
        this.graphOutputs[outputName] = value;
      }
    }

    if (result.subgraph) {
      const subGraphId = result.subgraph.graphId;
      const subgraph = this.findSubgraph(subGraphId);
      if (!subgraph) {
        this.failRuntime(`Subgraph ${subGraphId} not found.`);
        return false;
      }
      this.graphStack.push({
        graphId: this.currentGraphId,
        returnTo: { nodeId: node.id, execKey: result.exec },
      });
      this.currentGraphId = subgraph.id;
      this.currentNodeId = subgraph.entryNodeId;
      return true;
    }

    if (result.latent) {
      this.pending = this.createPendingLatent(node.id, result.latent, traceIndex);
      this.status = "waiting";
      if (this.pending.kind === "delay") {
        this.scheduleDelay(this.pending);
      }
      return true;
    }

    this.advanceFromNode(node.id, result.exec, traceIndex, result.data);
    return true;
  }

  // 处理节点执行异常：记录错误、写入轨迹并尝试走错误分支
  private handleNodeError(node: Graph["nodes"][number], def: NodeDefinition, error: string, traceIndex: number) {
    // 统一记录错误
    this.errors.push(error);
    const hasOnError = def.outputs.some((pin) => pin.kind === "exec" && pin.key === "onError");
    if (hasOnError) {
      this.advanceFromNode(node.id, "onError", traceIndex, {});
      return;
    }
    this.status = "error";
    this.viewModel = { kind: "error", title: "Runtime Error", body: error };
  }

  // 根据执行引脚推进到下一个节点
  private advanceFromNode(nodeId: string, execKey: string | undefined, traceIndex: number, outputs: Record<string, unknown>) {
    if (outputs && Object.keys(outputs).length > 0) {
      this.dataCache[nodeId] = outputs;
      const trace = this.trace[traceIndex];
      if (trace) {
        trace.outputs = outputs;
      }
      const io = this.lastNodeIO[nodeId];
      if (io) {
        io.outputs = outputs;
      }
    }

    if (!execKey) {
      this.finishOrReturn();
      return;
    }
    const graphCtx = this.getGraphContext(this.currentGraphId);
    if (!graphCtx) {
      this.failRuntime("Graph context missing.");
      return;
    }
    const edge = graphCtx.edgesByFrom.get(nodeId)?.get(execKey);
    if (!edge) {
      this.finishOrReturn();
      return;
    }
    this.currentNodeId = edge.to.nodeId;
  }

  // 当前图执行完成：若存在上层图则返回，否则结束
  private finishOrReturn() {
    if (this.graphStack.length > 0) {
      const frame = this.graphStack.pop();
      if (frame) {
        this.currentGraphId = frame.graphId;
        if (frame.returnTo) {
          const { nodeId, execKey } = frame.returnTo;
          this.advanceFromNode(nodeId, execKey, this.trace.length - 1, {});
          return;
        }
      }
    }
    this.currentNodeId = null;
    this.status = "finished";
    this.viewModel = { kind: "done", title: "Complete", body: "Graph finished." };
  }

  // 解析节点输入：沿数据边收集上游输出或默认值
  private resolveInputs(
    graphCtx: GraphContext,
    node: Graph["nodes"][number],
    def: NodeDefinition,
    visiting: Set<string>
  ) {
    const inputs: Record<string, unknown> = {};
    for (const pin of def.inputs) {
      if (pin.kind !== "data") continue;
      const edge = graphCtx.edgesByTo.get(node.id)?.get(pin.key);
      if (edge) {
        let upstreamOutputs = this.dataCache[edge.from.nodeId];
        if (!upstreamOutputs || !(edge.from.pinKey in upstreamOutputs)) {
          const upstreamNode = graphCtx.nodeMap.get(edge.from.nodeId);
          const upstreamDef = upstreamNode ? this.getNodeDefinition(upstreamNode) : null;
          if (upstreamNode && upstreamDef && this.isDataOnlyDefinition(upstreamDef)) {
            upstreamOutputs = this.computeDataNode(graphCtx, upstreamNode, upstreamDef, visiting);
          }
        }
        if (!upstreamOutputs || !(edge.from.pinKey in upstreamOutputs)) {
          throw new Error(`Missing data for ${edge.from.nodeId}.${edge.from.pinKey}`);
        }
        inputs[pin.key] = upstreamOutputs[edge.from.pinKey];
      } else if (pin.defaultValue !== undefined) {
        inputs[pin.key] = pin.defaultValue;
      } else if (pin.required) {
        throw new Error(`Required input ${node.id}.${pin.key} is not connected.`);
      }
    }
    return inputs;
  }

  // 判断是否为纯数据节点（无执行引脚）
  private isDataOnlyDefinition(def: NodeDefinition) {
    return !def.inputs.some((pin) => pin.kind === "exec") && !def.outputs.some((pin) => pin.kind === "exec");
  }

  // 计算纯数据节点并缓存结果
  private computeDataNode(
    graphCtx: GraphContext,
    node: Graph["nodes"][number],
    def: NodeDefinition,
    visiting: Set<string>
  ) {
    const cached = this.dataCache[node.id];
    if (cached) return cached;
    if (visiting.has(node.id)) {
      throw new Error(`Data dependency cycle detected at ${node.id}`);
    }
    visiting.add(node.id);
    const startMs = performance.now();
    const inputs = this.resolveInputs(graphCtx, node, def, visiting);
    const result = def.run({
      node,
      inputs,
      props: node.props,
      graph: graphCtx.graph,
      vars: this.vars,
    });
    if (result.deferred || result.latent) {
      throw new Error(`Data node ${node.id} cannot be async.`);
    }
    if (result.error) {
      throw new Error(result.error);
    }
    const outputs = result.data ?? {};
    this.dataCache[node.id] = outputs;
    this.lastNodeIO[node.id] = {
      inputs,
      outputs,
      durationMs: performance.now() - startMs,
      error: result.error,
      logs: result.logs,
    };
    visiting.delete(node.id);
    return outputs;
  }

  // 获取节点定义（若版本未找到则尝试最新版本）
  private getNodeDefinition(node: Graph["nodes"][number]) {
    return this.registry.get(node.type, node.version) ?? this.registry.getLatest(node.type);
  }

  // 获取图上下文并构建缓存映射
  private getGraphContext(graphId: string): GraphContext | null {
    const graph = this.findGraphById(graphId);
    if (!graph) return null;
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgesByTo = new Map<string, Map<string, Graph["edges"][number]>>();
    const edgesByFrom = new Map<string, Map<string, Graph["edges"][number]>>();
    for (const edge of graph.edges) {
      if (!edgesByTo.has(edge.to.nodeId)) edgesByTo.set(edge.to.nodeId, new Map());
      if (!edgesByFrom.has(edge.from.nodeId)) edgesByFrom.set(edge.from.nodeId, new Map());
      edgesByTo.get(edge.to.nodeId)?.set(edge.to.pinKey, edge);
      edgesByFrom.get(edge.from.nodeId)?.set(edge.from.pinKey, edge);
    }
    return { graph, nodeMap, edgesByTo, edgesByFrom };
  }

  // 在主图或子图中查找指定图
  private findGraphById(graphId: string) {
    if (this.rootGraph.id === graphId) return this.rootGraph;
    return this.rootGraph.subgraphs?.[graphId] ?? null;
  }

  // 从子图集合中查找子图
  private findSubgraph(graphId: string) {
    return this.rootGraph.subgraphs?.[graphId] ?? null;
  }

  // 创建挂起状态对象
  private createPendingLatent(nodeId: string, latent: LatentToken, traceIndex: number): PendingLatent {
    if (latent.kind === "choice") {
      return {
        kind: "choice",
        nodeId,
        options: latent.options,
        execByChoice: latent.execByChoice,
        outputsByChoice: latent.outputsByChoice,
        traceIndex,
      };
    }
    if (latent.kind === "delay") {
      return {
        kind: "delay",
        nodeId,
        resumeExec: latent.resumeExec,
        ms: latent.ms,
        timerId: null,
        traceIndex,
      };
    }
    return {
      kind: "next",
      nodeId,
      resumeExec: latent.resumeExec,
      traceIndex,
    };
  }

  // 处理延迟挂起：通过定时器继续执行
  private scheduleDelay(pending: DelayPending) {
    const timerId = window.setTimeout(() => {
      if (!this.pending || this.pending.kind !== "delay") return;
      if (this.pending.nodeId !== pending.nodeId) return;
      const resumeExec = pending.resumeExec;
      const traceIndex = pending.traceIndex;
      this.pending = null;
      this.status = "running";
      this.advanceFromNode(pending.nodeId, resumeExec, traceIndex, {});
      this.run();
    }, pending.ms);
    pending.timerId = timerId;
    this.timers.push(timerId);
  }

  // 清理挂起状态与定时器
  private clearLatent() {
    this.pending = null;
    this.status = "idle";
    this.deferredToken += 1;
    for (const timerId of this.timers) {
      window.clearTimeout(timerId);
    }
    this.timers = [];
  }

  // 运行失败：进入错误状态并记录信息
  private failRuntime(message: string) {
    this.status = "error";
    this.viewModel = { kind: "error", title: "Runtime Error", body: message };
    this.errors.push(message);
  }

  // 发送快照通知订阅者
  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  // 构建运行元信息
  private createRunMeta(inputs: Record<string, unknown>, presetId?: string, seed?: number): RunMeta {
    const nodeVersions: Record<string, number> = {};
    for (const node of this.rootGraph.nodes) {
      nodeVersions[node.id] = node.version;
    }
    return {
      runId: this.runId,
      graphId: this.rootGraph.id,
      graphVersion: this.rootGraph.version,
      nodeVersions,
      presetId,
      inputsSnapshot: { ...inputs },
      choices: [],
      seed: seed ?? 0,
    };
  }

  // 将图输入写入运行时变量（便于脚本使用）
  private seedGraphInputs() {
    const contract = normalizeContract(this.rootGraph.contract);
    const inputMap = new Map(contract.inputs.map((item) => [item.name, item]));
    for (const node of this.rootGraph.nodes) {
      if (node.type !== "GraphInput") continue;
      const name = typeof node.props.name === "string" ? node.props.name : "";
      const port = name ? inputMap.get(name) : undefined;
      if (!name || !port) continue;
      const value = this.graphInputs[name] ?? port.defaultValue;
      this.dataCache[node.id] = { value };
    }
  }
}
