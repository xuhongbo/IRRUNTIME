// 文件说明：自动补充文件级注释，描述模块职责与用途

// 纯画布页面：仅显示节点画布，不含编辑面板
import React from "react";
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import type { Command } from "../studio/commands";
import { ReteCanvas } from "../studio/rete/ReteCanvas";
import "./CanvasOnly.css";

// 纯画布组件参数
type CanvasOnlyProps = {
  graph: Graph;
  registry: Registry;
  selectedNodeId: string | null;
  focusedPin: { nodeId: string; pinKey: string } | null;
  validationErrors: ValidationError[];
  runningNodeId: string | null;
  breakpoints: string[];
  selectedNodeIds?: string[];
  suppressDrag?: boolean;
  snapToGrid?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
  onCommand: (command: Command) => void;
  onBackToStudio?: () => void;
};

// 纯画布组件
export const CanvasOnly = ({
  graph,
  registry,
  selectedNodeId,
  focusedPin,
  validationErrors,
  runningNodeId,
  breakpoints,
  selectedNodeIds,
  suppressDrag,
  snapToGrid,
  onSelectNode,
  onSelectNodes,
  onCommand,
  onBackToStudio,
}: CanvasOnlyProps) => {
  return (
    <div className="canvas-only-root" data-testid="canvas-only-root">
      <header className="canvas-only-header">
        <div>
          <div className="canvas-only-title">画布</div>
          <div className="canvas-only-subtitle">{graph.id}</div>
        </div>
        <div className="canvas-only-actions">
          {onBackToStudio && (
            <button className="button" onClick={onBackToStudio}>
              返回工作区
            </button>
          )}
        </div>
      </header>
      <div className="canvas-only-body">
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
          focusedPin={focusedPin}
          validationErrors={validationErrors}
          runningNodeId={runningNodeId}
          breakpoints={breakpoints}
          suppressDrag={suppressDrag}
          snapToGrid={snapToGrid}
          onCommand={onCommand}
          onSelectNode={onSelectNode}
          onSelectNodes={onSelectNodes}
        />
      </div>
    </div>
  );
};
