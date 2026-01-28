import { VariableScope } from "../runtime/Scope";
import { GraphRunner } from "../runtime/GraphRunner";
import { NodeInstance } from "../ir";

export type PinType = 'exec' | 'string' | 'number' | 'boolean' | 'json' | 'any';

export interface PinDefinition {
  name: string;
  type: PinType;
  label?: string;
  required?: boolean;
  default?: any;
}

export interface NodeDisplayOptions {
  show?: {
    [propertyName: string]: any[];
  };
}

export interface NodeProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'select' | 'textarea';
  label: string;
  default?: any;
  options?: { name: string; value: any }[];
  displayOptions?: NodeDisplayOptions;
}

export interface NodeExecutionResult {
  // For exec outputs: which output pin to trigger?
  nextExec?: string; 
  // For data outputs: values produced
  outputs?: Record<string, any>;
  // For latent nodes (async)
  latent?: Promise<NodeExecutionResult>;
}

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
