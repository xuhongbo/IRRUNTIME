import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import type { Command } from "../studio/commands";
import { ReteCanvas } from "../studio/rete/ReteCanvas";
import type { ValidationError } from "../engine/validator";
import "./GraphViewer.css";

type GraphViewerProps = {
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
  onToggleSnap?: () => void;
  onAlign?: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  onDistribute?: (mode: "horizontal" | "vertical") => void;
  onAutoLayout?: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
  onCommand: (command: Command) => void;
};

export const GraphViewer = ({
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
  onToggleSnap,
  onAlign,
  onDistribute,
  onAutoLayout,
  onSelectNode,
  onSelectNodes,
  onCommand,
}: GraphViewerProps) => {
  return (
    <div className="graph-viewer">
      <div className="graph-header">
        <div>
          <div className="graph-title">图编辑器</div>
          <div className="graph-subtitle">图标识：{graph.id}</div>
          <div className="graph-hint">提示：拖拽空白处平移，滚轮缩放，按住 Ctrl/⌘ 可多选。</div>
        </div>
        <div className="graph-meta">
          <span>节点数：{graph.nodes.length}</span>
          <div className="graph-tools">
            <button className="button" onClick={onToggleSnap}>
              {snapToGrid ? "网格对齐：开" : "网格对齐：关"}
            </button>
            <button className="button" onClick={() => onAlign?.("left")}>
              左对齐
            </button>
            <button className="button" onClick={() => onAlign?.("top")}>
              顶对齐
            </button>
            <button className="button" onClick={() => onAlign?.("centerX")}>
              水平居中
            </button>
            <button className="button" onClick={() => onAlign?.("centerY")}>
              垂直居中
            </button>
            <button className="button" onClick={() => onAlign?.("right")}>
              右对齐
            </button>
            <button className="button" onClick={() => onAlign?.("bottom")}>
              底对齐
            </button>
            <button className="button" onClick={() => onDistribute?.("horizontal")}>
              水平分布
            </button>
            <button className="button" onClick={() => onDistribute?.("vertical")}>
              垂直分布
            </button>
            <button className="button" onClick={onAutoLayout}>
              自动布局
            </button>
          </div>
        </div>
      </div>
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
  );
};
