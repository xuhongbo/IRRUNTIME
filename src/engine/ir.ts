// 引脚类型：执行流引脚或数据引脚
export type PinKind = "exec" | "data";

// 数据类型：用于数据引脚的类型约束
export type DataType = "string" | "number" | "boolean" | "json";

// 图输入/输出契约端口定义
export type GraphContractPort = {
  name: string;
  type: DataType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  examples?: unknown[];
};

// 图契约：输入与输出端口列表
export type GraphContract = {
  inputs: GraphContractPort[];
  outputs: GraphContractPort[];
};

// 预设：一组可复用的图输入配置
export type GraphPreset = {
  id: string;
  title: string;
  description?: string;
  inputs: Record<string, unknown>;
};

// 引脚引用：用于边连接的端点
export type PinRef = {
  nodeId: string;
  pinKey: string;
};

// 边：从一个引脚连接到另一个引脚
export type Edge = {
  id: string;
  from: PinRef;
  to: PinRef;
};

// 节点位置：画布坐标
export type NodePosition = {
  x: number;
  y: number;
};

// 节点实例：图中的实际节点
export type NodeInstance = {
  id: string;
  type: string;
  version: number;
  props: Record<string, unknown>;
  title?: string;
  pos: NodePosition;
};

// 图结构：节点、边、契约与子图
export type Graph = {
  id: string;
  version: number;
  entryNodeId: string;
  nodes: NodeInstance[];
  edges: Edge[];
  contract?: GraphContract;
  presets?: GraphPreset[];
  subgraphs?: Record<string, Graph>;
};

// 节点执行输入/输出记录：用于运行时快照与追踪
export type NodeIO = {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  durationMs: number;
  error?: string;
  logs?: string[];
};
