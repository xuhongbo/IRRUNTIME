import { useEffect, useMemo, useRef, useState } from "react";
import { registry } from "./engine/registry";
import type { Graph } from "./engine/ir";
import { useRuntime } from "./ui/useRuntime";
import { GraphViewer } from "./ui/GraphViewer";
import { Inspector } from "./ui/Inspector";
import { Runner } from "./ui/Runner";
import { TracePanel } from "./ui/TracePanel";
import { JsonTab } from "./ui/JsonTab";
import { GraphSettings } from "./ui/GraphSettings";
import { useStudio } from "./studio/useStudio";
import { stringifyGraph } from "./studio/json";
import { applyCommand } from "./studio/commands";
import { getGraphCenter } from "./studio/layout";
import { Palette } from "./ui/Palette";
import { CanvasOnly } from "./ui/CanvasOnly";
import { useGraphSync } from "./studio/sync";
import { normalizeContract } from "./engine/contract";
import {
  canRedo,
  canUndo,
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./studio/history";
import "./App.css";

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname === "/canvas") {
    return <CanvasOnlyApp />;
  }
  return <StudioApp />;
}

const StudioApp = () => {
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("app:render");
    }
  }
  const { state, send, updateGraph } = useStudio();
  const graph = state.context.graph;
  const graphRef = useRef(graph);
  const { runtime, snapshot } = useRuntime(graph, registry);
  const [tab, setTab] = useState<"studio" | "json" | "graph">("studio");
  const graphCenter = useMemo(() => getGraphCenter(graph), [graph]);
  const pendingSnapshotRef = useRef(false);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);
  const [graphInputs, setGraphInputs] = useState<Record<string, unknown>>({});
  const historyRef = useRef(createHistoryState(80));
  const pendingHistoryRef = useRef(false);
  const historyActionRef = useRef<"undo" | "redo" | "remote" | null>(null);
  const contract = useMemo(() => normalizeContract(graph.contract), [graph.contract]);

  const buildDefaultInputs = (nextContract: typeof contract, current: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    for (const input of nextContract.inputs) {
      if (input.name in current) {
        result[input.name] = current[input.name];
        continue;
      }
      if (input.type === "number") result[input.name] = 0;
      else if (input.type === "boolean") result[input.name] = false;
      else if (input.type === "json") result[input.name] = null;
      else result[input.name] = "";
    }
    return result;
  };

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    setGraphInputs((current) => buildDefaultInputs(contract, current));
  }, [contract]);

  useEffect(() => {
    if (historyActionRef.current === "remote") {
      historyActionRef.current = null;
      return;
    }
    if (historyActionRef.current === "undo" || historyActionRef.current === "redo") {
      historyActionRef.current = null;
      return;
    }
    if (!pendingHistoryRef.current) return;
    pendingHistoryRef.current = false;
    historyRef.current = pushHistory(historyRef.current, graphRef.current);
  }, [graph]);

  const sync = useGraphSync({
    graph,
    mode: "main",
    onApplyGraph: (next) => {
      setIsRemoteSyncing(true);
      historyActionRef.current = "remote";
      updateGraph(next);
      setTimeout(() => setIsRemoteSyncing(false), 0);
    },
    onApplyCommand: (command) => {
      setIsRemoteSyncing(true);
      historyActionRef.current = "remote";
      updateGraph(applyCommand(graphRef.current, command));
      setTimeout(() => setIsRemoteSyncing(false), 0);
    },
  });

  useEffect(() => {
    if (pendingSnapshotRef.current) {
      sync.sendSnapshot(graph);
      pendingSnapshotRef.current = false;
    }
  }, [graph, sync]);

  const statusBlock = useMemo(() => {
    switch (state.context.validationStatus) {
      case "validating":
        return <div className="status-block warn">Validating...</div>;
      case "valid":
        return <div className="status-block ok">Graph validated.</div>;
      case "invalid":
        return (
          <div className="status-block error">
            {state.context.validationErrors.length} validation error(s). Fix before running.
          </div>
        );
      default:
        return <div className="status-block">Idle.</div>;
    }
  }, [state.context.validationErrors.length, state.context.validationStatus]);

  const applyProps = (nodeId: string, props: Record<string, unknown>) => {
    const command = { type: "SET_PROP", nodeId, props } as const;
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  const addNode = (node: Graph["nodes"][number]) => {
    const command = { type: "ADD_NODE", node } as const;
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
    send({ type: "SELECT_NODE", nodeId: node.id });
  };

  const deleteNode = (nodeId: string) => {
    const command = { type: "DELETE_NODE", nodeId } as const;
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
    send({ type: "SELECT_NODE", nodeId: null });
  };

  const handleCommand = (command: Parameters<typeof applyCommand>[1]) => {
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  const handleOpenCanvasWindow = () => {
    if (typeof window === "undefined") return;
    window.open("/canvas", "graph-canvas", "popup,width=1400,height=900");
  };

  const applyContract = (nextContract: typeof contract) => {
    const command = { type: "SET_CONTRACT", contract: nextContract } as const;
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  const handleUndo = () => {
    const result = undoHistory(historyRef.current, graphRef.current);
    if (!result.graph) return;
    historyRef.current = result.state;
    historyActionRef.current = "undo";
    pendingSnapshotRef.current = true;
    updateGraph(result.graph);
  };

  const handleRedo = () => {
    const result = redoHistory(historyRef.current, graphRef.current);
    if (!result.graph) return;
    historyRef.current = result.state;
    historyActionRef.current = "redo";
    pendingSnapshotRef.current = true;
    updateGraph(result.graph);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = window.navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app" data-testid="studio-root">
      <header className="app-header">
        <div>
          <div className="app-title">Graph Studio Demo</div>
          <div className="app-subtitle">Blueprints semantics with n8n-style metadata UI</div>
        </div>
        <div className="app-actions">
          <button
            className="button"
            data-testid="undo"
            disabled={!canUndo(historyRef.current)}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            className="button"
            data-testid="redo"
            disabled={!canRedo(historyRef.current)}
            onClick={handleRedo}
          >
            Redo
          </button>
          <button
            className="button"
            data-testid="open-canvas-window"
            onClick={handleOpenCanvasWindow}
          >
            Open Canvas Window
          </button>
          <button className="button" onClick={() => runtime.reset()}>
            Reset
          </button>
          <button
            className="button"
            onClick={() => {
              runtime.setInputs(graphInputs);
              runtime.step();
            }}
          >
            Step
          </button>
          <button
            className="button primary"
            onClick={() => {
              runtime.setInputs(graphInputs);
              runtime.run();
            }}
          >
            Run
          </button>
          <div className={`status-pill ${snapshot.status}`}>{snapshot.status}</div>
        </div>
      </header>

      <section className="status-bar">
        {statusBlock}
        <div className="status-tabs">
          <button
            className={`tab ${tab === "studio" ? "active" : ""}`}
            onClick={() => setTab("studio")}
            data-testid="tab-studio"
          >
            Studio
          </button>
          <button
            className={`tab ${tab === "json" ? "active" : ""}`}
            onClick={() => setTab("json")}
            data-testid="tab-json"
          >
            JSON
          </button>
          <button
            className={`tab ${tab === "graph" ? "active" : ""}`}
            onClick={() => setTab("graph")}
            data-testid="tab-graph"
          >
            Graph
          </button>
        </div>
      </section>

      {tab === "studio" && (
        <>
          <main className="layout">
            <Palette graph={graph} registry={registry} center={graphCenter} onAddNode={addNode} />
            <GraphViewer
              graph={graph}
              registry={registry}
              selectedNodeId={state.context.selectedNodeId}
              focusedPin={state.context.focusedPin}
              validationErrors={state.context.validationErrors}
              runningNodeId={snapshot.currentNodeId}
              breakpoints={snapshot.breakpoints}
              suppressDrag={isRemoteSyncing}
              onSelectNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
              onCommand={handleCommand}
            />
            <Inspector
              graph={graph}
              nodeId={state.context.selectedNodeId}
              registry={registry}
              lastNodeIO={snapshot.lastNodeIO}
              validationErrors={state.context.validationErrors}
              onApplyProps={applyProps}
              onDeleteNode={deleteNode}
              hasBreakpoint={
                state.context.selectedNodeId
                  ? snapshot.breakpoints.includes(state.context.selectedNodeId)
                  : false
              }
              onToggleBreakpoint={(nodeId) => runtime.toggleBreakpoint(nodeId)}
            />
          </main>

          <section className="bottom-row">
            <Runner
              viewModel={snapshot.viewModel}
              status={snapshot.status}
              outputs={snapshot.outputs}
              onNext={() => runtime.dispatchNext()}
              onChoose={(choiceKey) => runtime.dispatchChoice(choiceKey)}
            />
            <TracePanel trace={snapshot.trace} />
          </section>
        </>
      )}

      {tab === "json" && (
        <section className="json-section">
          <JsonTab
            draft={state.context.jsonDraft}
            error={state.context.jsonError}
            onChange={(draft) => send({ type: "JSON_EDIT", draft })}
            onApply={() => {
              pendingSnapshotRef.current = true;
              pendingHistoryRef.current = true;
              send({ type: "APPLY_JSON" });
            }}
            onReset={() => send({ type: "SYNC_JSON", draft: stringifyGraph(graph) })}
          />
        </section>
      )}

      {tab === "graph" && (
        <section className="graph-section">
          <GraphSettings
            contract={contract}
            inputValues={graphInputs}
            onChangeInputs={(next) => setGraphInputs(next)}
            onApplyContract={applyContract}
          />
        </section>
      )}

      {state.context.validationStatus === "invalid" && (
        <section className="errors-panel">
          <div className="errors-title">Validation Errors</div>
          <div className="errors-list">
            {state.context.validationErrors.map((err, index) => (
              <div
                key={`${err.nodeId ?? "graph"}-${index}`}
                className="errors-item"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!err.nodeId) return;
                  if (err.pinKey) {
                    send({ type: "FOCUS_PIN", nodeId: err.nodeId, pinKey: err.pinKey });
                  } else {
                    send({ type: "SELECT_NODE", nodeId: err.nodeId });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  if (!err.nodeId) return;
                  if (err.pinKey) {
                    send({ type: "FOCUS_PIN", nodeId: err.nodeId, pinKey: err.pinKey });
                  } else {
                    send({ type: "SELECT_NODE", nodeId: err.nodeId });
                  }
                }}
              >
                <strong>{err.nodeId ?? "(graph)"}</strong>
                {err.pinKey ? `.${err.pinKey}` : ""}: {err.message}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const CanvasOnlyApp = () => {
  const { state, send, updateGraph } = useStudio();
  const graph = state.context.graph;
  const graphRef = useRef(graph);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const sync = useGraphSync({
    graph,
    mode: "canvas",
    onApplyGraph: (next) => {
      setIsRemoteSyncing(true);
      updateGraph(next);
      setTimeout(() => setIsRemoteSyncing(false), 0);
    },
    onApplyCommand: (command) => {
      setIsRemoteSyncing(true);
      updateGraph(applyCommand(graphRef.current, command));
      setTimeout(() => setIsRemoteSyncing(false), 0);
    },
  });

  useEffect(() => {
    sync.requestSnapshot();
  }, [sync]);

  const handleCommand = (command: Parameters<typeof applyCommand>[1]) => {
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  return (
    <CanvasOnly
      graph={graph}
      registry={registry}
      selectedNodeId={state.context.selectedNodeId}
      focusedPin={state.context.focusedPin}
      validationErrors={state.context.validationErrors}
      runningNodeId={null}
      breakpoints={[]}
      suppressDrag={isRemoteSyncing}
      onSelectNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
      onCommand={handleCommand}
      onBackToStudio={() => {
        if (typeof window === "undefined") return;
        window.location.href = "/";
      }}
    />
  );
};
