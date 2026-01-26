import type { NodeInstance } from "../../engine/ir";
import type { PinDef, Registry } from "../../engine/registry";

export type ReteNodeData = NodeInstance & {
  label: string;
  inputsMeta: PinDef[];
  outputsMeta: PinDef[];
  registry: Registry;
  nodeErrors: string[];
  pinErrors: Record<string, string[]>;
  focusedPinKey: string | null;
  isRunning: boolean;
  hasBreakpoint: boolean;
};

export type ReteConnectionData = {
  id: string;
  source: string;
  target: string;
  sourceOutput: string;
  targetInput: string;
  isExec: boolean;
};
