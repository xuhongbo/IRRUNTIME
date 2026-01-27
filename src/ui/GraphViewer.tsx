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
          <div className="graph-title">Graph Viewer</div>
          <div className="graph-subtitle">{graph.id}</div>
        </div>
        <div className="graph-meta">
          <span>Nodes: {graph.nodes.length}</span>
          <div className="graph-tools">
            <button className="button" onClick={onToggleSnap}>
              {snapToGrid ? "Snap On" : "Snap Off"}
            </button>
            <button className="button" onClick={() => onAlign?.("left")}>
              Align Left
            </button>
            <button className="button" onClick={() => onAlign?.("top")}>
              Align Top
            </button>
            <button className="button" onClick={() => onAlign?.("centerX")}>
              Align Center X
            </button>
            <button className="button" onClick={() => onAlign?.("centerY")}>
              Align Center Y
            </button>
            <button className="button" onClick={() => onAlign?.("right")}>
              Align Right
            </button>
            <button className="button" onClick={() => onAlign?.("bottom")}>
              Align Bottom
            </button>
            <button className="button" onClick={() => onDistribute?.("horizontal")}>
              Distribute X
            </button>
            <button className="button" onClick={() => onDistribute?.("vertical")}>
              Distribute Y
            </button>
            <button className="button" onClick={onAutoLayout}>
              Auto Layout
            </button>
          </div>
        </div>
      </div>
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={selectedNodeId}
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
