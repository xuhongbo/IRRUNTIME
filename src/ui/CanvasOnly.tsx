import React from "react";
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import type { Command } from "../studio/commands";
import { ReteCanvas } from "../studio/rete/ReteCanvas";
import "./CanvasOnly.css";

type CanvasOnlyProps = {
  graph: Graph;
  registry: Registry;
  selectedNodeId: string | null;
  focusedPin: { nodeId: string; pinKey: string } | null;
  validationErrors: ValidationError[];
  runningNodeId: string | null;
  breakpoints: string[];
  suppressDrag?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onCommand: (command: Command) => void;
  onBackToStudio?: () => void;
};

export const CanvasOnly = ({
  graph,
  registry,
  selectedNodeId,
  focusedPin,
  validationErrors,
  runningNodeId,
  breakpoints,
  suppressDrag,
  onSelectNode,
  onCommand,
  onBackToStudio,
}: CanvasOnlyProps) => {
  return (
    <div className="canvas-only-root" data-testid="canvas-only-root">
      <header className="canvas-only-header">
        <div>
          <div className="canvas-only-title">Canvas</div>
          <div className="canvas-only-subtitle">{graph.id}</div>
        </div>
        <div className="canvas-only-actions">
          {onBackToStudio && (
            <button className="button" onClick={onBackToStudio}>
              Back to Studio
            </button>
          )}
        </div>
      </header>
      <div className="canvas-only-body">
        <ReteCanvas
          graph={graph}
          registry={registry}
          selectedNodeId={selectedNodeId}
          focusedPin={focusedPin}
        validationErrors={validationErrors}
        runningNodeId={runningNodeId}
        breakpoints={breakpoints}
        suppressDrag={suppressDrag}
        onCommand={onCommand}
        onSelectNode={onSelectNode}
      />
      </div>
    </div>
  );
};
