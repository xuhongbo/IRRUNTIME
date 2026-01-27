import { addComponent, addEntity, createWorld, removeComponent, removeEntity } from "bitecs";
import type { Graph } from "../engine/ir";
import type { ValidationError } from "../engine/validator";
import type { ValidationStatus } from "./machine";
import type { RuntimeSnapshot } from "../engine/runtime";

export const GraphRef = {};
export const NodeTag = {};
export const Selected = {};
export const HasError = {};

export type EcsState = {
  world: ReturnType<typeof createWorld>;
  graphEntity: number;
  nodeEntities: Map<string, number>;
  selectedNodeId: string | null;
  validationStatus: ValidationStatus;
  validationErrors: ValidationError[];
  runtimeStatus: RuntimeSnapshot["status"];
  runningNodeId: string | null;
  breakpoints: string[];
  trace: RuntimeSnapshot["trace"];
  lastNodeIO: RuntimeSnapshot["lastNodeIO"];
};

export const createEcsState = (graph: Graph): EcsState => {
  const world = createWorld();
  const graphEntity = addEntity(world);
  addComponent(world, graphEntity, GraphRef);
  const nodeEntities = new Map<string, number>();
  for (const node of graph.nodes) {
    const eid = addEntity(world);
    addComponent(world, eid, NodeTag);
    nodeEntities.set(node.id, eid);
  }
  return {
    world,
    graphEntity,
    nodeEntities,
    selectedNodeId: graph.entryNodeId,
    validationStatus: "idle",
    validationErrors: [],
    runtimeStatus: "idle",
    runningNodeId: null,
    breakpoints: [],
    trace: [],
    lastNodeIO: {},
  };
};

export const syncGraphToEcs = (state: EcsState, graph: Graph) => {
  const existing = new Set(state.nodeEntities.keys());
  for (const node of graph.nodes) {
    if (!state.nodeEntities.has(node.id)) {
      const eid = addEntity(state.world);
      addComponent(state.world, eid, NodeTag);
      state.nodeEntities.set(node.id, eid);
    }
    existing.delete(node.id);
  }
  for (const staleId of existing) {
    const eid = state.nodeEntities.get(staleId);
    if (eid !== undefined) {
      removeEntity(state.world, eid);
    }
    state.nodeEntities.delete(staleId);
  }
  if (state.selectedNodeId && !state.nodeEntities.has(state.selectedNodeId)) {
    state.selectedNodeId = graph.entryNodeId;
  }
};

export const setSelection = (state: EcsState, nodeId: string | null) => {
  for (const [id, eid] of state.nodeEntities.entries()) {
    if (id === nodeId) {
      addComponent(state.world, eid, Selected);
    } else {
      removeComponent(state.world, eid, Selected);
    }
  }
  state.selectedNodeId = nodeId;
};

export const setValidationState = (
  state: EcsState,
  status: ValidationStatus,
  errors: ValidationError[]
) => {
  state.validationStatus = status;
  state.validationErrors = errors;
};

export const setRuntimeState = (state: EcsState, snapshot: RuntimeSnapshot) => {
  state.runtimeStatus = snapshot.status;
  state.runningNodeId = snapshot.currentNodeId;
  state.breakpoints = snapshot.breakpoints;
  state.trace = snapshot.trace;
  state.lastNodeIO = snapshot.lastNodeIO;
};
