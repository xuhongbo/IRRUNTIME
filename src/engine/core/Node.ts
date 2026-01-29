// 文件说明：自动补充文件级注释，描述模块职责与用途

// 旧版节点定义类型
import { VariableScope } from "../runtime/Scope";
import { GraphRunner } from "../runtime/GraphRunner";
import { NodeInstance } from "../ir";

// 引脚类型（旧版）
export type PinType = 'exec' | 'string' | 'number' | 'boolean' | 'json' | 'any';

// 引脚定义
export interface PinDefinition {
  name: string;
  type: PinType;
  label?: string;
  required?: boolean;
  default?: any;
}

// 属性显示条件
export interface NodeDisplayOptions {
  show?: {
    [propertyName: string]: any[];
  };
}

// 节点属性定义
export interface NodeProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'select' | 'textarea';
  label: string;
  default?: any;
  options?: { name: string; value: any }[];
  displayOptions?: NodeDisplayOptions;
}

// 节点执行结果（旧版）
export interface NodeExecutionResult {
  // For exec outputs: which output pin to trigger?
  nextExec?: string; 
  // For data outputs: values produced
  outputs?: Record<string, any>;
  // For latent nodes (async)
  latent?: Promise<NodeExecutionResult>;
}

// 执行上下文（旧版）
export interface ExecutionContext {
  // Current node instance data
  nodeId: string;
  properties: Record<string, any>;
  
  // Access to data
  scope: VariableScope;
  
  // Helpers
  getInput(name: string): Promise<any>; // Pull data from upstream
  getProperty(name: string): any; // Get property value (handling defaults)
  
  // Runtime control
  runner: GraphRunner;
}

// 节点定义（旧版）
export interface GameNodeDefinition {
  type: string;
  version: number;
  category: string;
  title: string;
  description?: string;
  
  inputs: PinDefinition[];
  outputs: PinDefinition[];
  properties: NodeProperty[];

  execute(ctx: ExecutionContext): Promise<NodeExecutionResult> | NodeExecutionResult;
}
