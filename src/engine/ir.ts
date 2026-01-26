export type PinKind = "exec" | "data";

export type DataType = "string" | "number" | "boolean" | "json";

export type GraphContractPort = {
  name: string;
  type: DataType;
};

export type GraphContract = {
  inputs: GraphContractPort[];
  outputs: GraphContractPort[];
};

export type PinRef = {
  nodeId: string;
  pinKey: string;
};

export type Edge = {
  id: string;
  from: PinRef;
  to: PinRef;
};

export type NodePosition = {
  x: number;
  y: number;
};

export type NodeInstance = {
  id: string;
  type: string;
  version: number;
  props: Record<string, unknown>;
  title?: string;
  pos: NodePosition;
};

export type Graph = {
  id: string;
  version: number;
  entryNodeId: string;
  nodes: NodeInstance[];
  edges: Edge[];
  contract?: GraphContract;
  subgraphs?: Record<string, Graph>;
};

export type NodeIO = {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  durationMs: number;
  error?: string;
};
