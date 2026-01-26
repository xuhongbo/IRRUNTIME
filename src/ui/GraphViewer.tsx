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
  onSelectNode: (nodeId: string | null) => void;
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
  onSelectNode,
  onCommand,
}: GraphViewerProps) => {
  return (
    <div className="graph-viewer">
      <div className="graph-header">
        <div>
          <div className="graph-title">Graph Viewer</div>
          <div className="graph-subtitle">{graph.id}</div>
        </div>
        <div className="graph-meta">Nodes: {graph.nodes.length}</div>
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
        onCommand={onCommand}
        onSelectNode={onSelectNode}
      />
    </div>
  );
};
