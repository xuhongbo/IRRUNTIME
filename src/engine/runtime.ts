import type { Graph, NodeIO } from "./ir";
import type { Registry, RunResult, NodeDefinition, LatentToken } from "./registry";
import type { ViewModel } from "./viewModel";
import { normalizeContract } from "./contract";

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
};

export type RuntimeStatus = "idle" | "running" | "waiting" | "paused" | "error" | "finished";

export type RuntimeSnapshot = {
  status: RuntimeStatus;
  currentNodeId: string | null;
  viewModel: ViewModel | null;
  trace: TraceEntry[];
  breakpoints: string[];
  lastNodeIO: Record<string, NodeIO>;
  outputs: Record<string, unknown>;
  runId: number;
  errors: string[];
};

type GraphFrame = {
  graphId: string;
  returnTo: { nodeId: string; execKey: string | undefined } | null;
};

type ChoicePending = {
  kind: "choice";
  nodeId: string;
  options: { key: string; label: string }[];
  execByChoice: Record<string, string>;
  outputsByChoice: Record<string, Record<string, unknown>>;
  traceIndex: number;
};

type NextPending = {
  kind: "next";
  nodeId: string;
  resumeExec: string;
  traceIndex: number;
};

type DelayPending = {
  kind: "delay";
  nodeId: string;
  resumeExec: string;
  ms: number;
  timerId: number | null;
  traceIndex: number;
};

type PendingLatent = ChoicePending | NextPending | DelayPending;

type GraphContext = {
  graph: Graph;
  nodeMap: Map<string, Graph["nodes"][number]>;
  edgesByTo: Map<string, Map<string, Graph["edges"][number]>>;
  edgesByFrom: Map<string, Map<string, Graph["edges"][number]>>;
};

export class GraphRuntime {
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
  private runId = 1;
  private seq = 0;
  private errors: string[] = [];
  private timers: number[] = [];
  private stepBudget = 800;

  constructor(graph: Graph, registry: Registry) {
    this.rootGraph = graph;
    this.registry = registry;
    this.currentGraphId = graph.id;
    this.currentNodeId = graph.entryNodeId;
  }

  subscribe(listener: (snapshot: RuntimeSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RuntimeSnapshot {
    return {
      status: this.status,
      currentNodeId: this.currentNodeId,
      viewModel: this.viewModel,
      trace: [...this.trace],
      breakpoints: Array.from(this.breakpoints),
      lastNodeIO: { ...this.lastNodeIO },
      outputs: { ...this.graphOutputs },
      runId: this.runId,
      errors: [...this.errors],
    };
  }

  setGraph(graph: Graph) {
    this.rootGraph = graph;
    this.currentGraphId = graph.id;
    this.currentNodeId = graph.entryNodeId;
    this.graphStack = [];
    this.graphOutputs = {};
    this.seedGraphInputs();
    this.reset();
  }

  setInputs(inputs: Record<string, unknown>) {
    this.graphInputs = { ...inputs };
    this.seedGraphInputs();
    this.emit();
  }

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
    this.seedGraphInputs();
    this.runId += 1;
    this.emit();
  }

  toggleBreakpoint(nodeId: string) {
    if (this.breakpoints.has(nodeId)) {
      this.breakpoints.delete(nodeId);
    } else {
      this.breakpoints.add(nodeId);
    }
    this.emit();
  }

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

  runWithInputs(inputs: Record<string, unknown>) {
    this.setInputs(inputs);
    this.run();
    return { ...this.graphOutputs };
  }

  getOutputs() {
    return { ...this.graphOutputs };
  }

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

  dispatchNext() {
    if (!this.pending || this.pending.kind !== "next") return;
    const pending = this.pending;
    this.pending = null;
    this.status = "running";
    this.advanceFromNode(pending.nodeId, pending.resumeExec, pending.traceIndex, {});
    this.run();
  }

  dispatchChoice(choiceKey: string) {
    if (!this.pending || this.pending.kind !== "choice") return;
    const pending = this.pending;
    const execKey = pending.execByChoice[choiceKey];
    const outputs = pending.outputsByChoice[choiceKey] ?? {};
    if (!execKey) {
      this.failRuntime("Invalid choice selection.");
      return;
    }
    this.pending = null;
    this.status = "running";
    this.advanceFromNode(pending.nodeId, execKey, pending.traceIndex, outputs);
    this.run();
  }

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
      inputs = this.resolveInputs(graphCtx, node, def);
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
    };
    const traceIndex = this.trace.length;
    this.trace.push(traceEntry);
    this.seq += 1;

    this.lastNodeIO[node.id] = {
      inputs,
      outputs: result?.data ?? {},
      durationMs,
      error,
    };

    if (error) {
      this.handleNodeError(node, def, error, traceIndex);
      return true;
    }

    if (!result) {
      this.failRuntime("Node returned no result.");
      return false;
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

  private handleNodeError(node: Graph["nodes"][number], def: NodeDefinition, error: string, traceIndex: number) {
    const hasOnError = def.outputs.some((pin) => pin.kind === "exec" && pin.key === "onError");
    if (hasOnError) {
      this.advanceFromNode(node.id, "onError", traceIndex, {});
      return;
    }
    this.status = "error";
    this.viewModel = { kind: "error", title: "Runtime Error", body: error };
    this.errors.push(error);
  }

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

  private resolveInputs(graphCtx: GraphContext, node: Graph["nodes"][number], def: NodeDefinition) {
    const inputs: Record<string, unknown> = {};
    for (const pin of def.inputs) {
      if (pin.kind !== "data") continue;
      const edge = graphCtx.edgesByTo.get(node.id)?.get(pin.key);
      if (edge) {
        const upstreamOutputs = this.dataCache[edge.from.nodeId];
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

  private getNodeDefinition(node: Graph["nodes"][number]) {
    return this.registry.get(node.type, node.version) ?? this.registry.getLatest(node.type);
  }

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

  private findGraphById(graphId: string) {
    if (this.rootGraph.id === graphId) return this.rootGraph;
    return this.rootGraph.subgraphs?.[graphId] ?? null;
  }

  private findSubgraph(graphId: string) {
    return this.rootGraph.subgraphs?.[graphId] ?? null;
  }

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

  private clearLatent() {
    this.pending = null;
    this.status = "idle";
    for (const timerId of this.timers) {
      window.clearTimeout(timerId);
    }
    this.timers = [];
  }

  private failRuntime(message: string) {
    this.status = "error";
    this.viewModel = { kind: "error", title: "Runtime Error", body: message };
    this.errors.push(message);
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private seedGraphInputs() {
    const contract = normalizeContract(this.rootGraph.contract);
    const inputMap = new Map(contract.inputs.map((item) => [item.name, item.type]));
    for (const node of this.rootGraph.nodes) {
      if (node.type !== "GraphInput") continue;
      const name = typeof node.props.name === "string" ? node.props.name : "";
      if (!name || !inputMap.has(name)) continue;
      const value = this.graphInputs[name];
      this.dataCache[node.id] = { value };
    }
  }
}
