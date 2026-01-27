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
import { autoLayoutGraph, getGraphCenter } from "./studio/layout";
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
import { copySelection, defaultPasteOffset, duplicateSelection, pasteSelection } from "./studio/clipboard";
import { alignNodes, distributeNodes } from "./studio/align";
import { lintGraph } from "./studio/lint";
import { LintPanel } from "./ui/LintPanel";
import { createNodeInstance } from "./studio/nodeFactory";
import { CommandPalette } from "./ui/CommandPalette";
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [errorIndex, setErrorIndex] = useState(0);
  const historyRef = useRef(createHistoryState(80));
  const pendingHistoryRef = useRef(false);
  const historyActionRef = useRef<"undo" | "redo" | "remote" | null>(null);
  const clipboardRef = useRef<ReturnType<typeof copySelection> | null>(null);
  const seedRef = useRef(1);
  const contract = useMemo(() => normalizeContract(graph.contract), [graph.contract]);
  const presets = useMemo(() => graph.presets ?? [], [graph.presets]);
  const lintIssues = useMemo(() => lintGraph(graph), [graph]);

  const buildDefaultInputs = (nextContract: typeof contract, current: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    for (const input of nextContract.inputs) {
      if (input.name in current) {
        result[input.name] = current[input.name];
        continue;
      }
      if (input.defaultValue !== undefined) {
        result[input.name] = input.defaultValue;
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
    if (presets.length === 0) {
      setSelectedPresetId(null);
      return;
    }
    if (!selectedPresetId || !presets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(presets[0]?.id ?? null);
    }
  }, [presets, selectedPresetId]);

  useEffect(() => {
    applyPresetInputs(selectedPresetId);
  }, [selectedPresetId]);

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

  const deleteSelectedNodes = () => {
    if (selectedNodeIds.length === 0) return;
    let next = graphRef.current;
    pendingHistoryRef.current = true;
    for (const nodeId of selectedNodeIds) {
      const command = { type: "DELETE_NODE", nodeId } as const;
      next = applyCommand(next, command);
      sync.sendCommand(command);
    }
    updateGraph(next);
    send({ type: "SELECT_NODE", nodeId: null });
    setSelectedNodeIds([]);
  };

  const handleCommand = (command: Parameters<typeof applyCommand>[1]) => {
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  const applyCommands = (commands: Parameters<typeof applyCommand>[1][]) => {
    if (commands.length === 0) return;
    let next = graphRef.current;
    pendingHistoryRef.current = true;
    for (const command of commands) {
      next = applyCommand(next, command);
      sync.sendCommand(command);
    }
    updateGraph(next);
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

  const applyPresets = (nextPresets: typeof presets) => {
    const command = { type: "SET_PRESETS", presets: nextPresets } as const;
    pendingHistoryRef.current = true;
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  const applyPresetInputs = (presetId: string | null) => {
    if (!presetId) return;
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    const defaults = buildDefaultInputs(contract, {});
    setGraphInputs({ ...defaults, ...preset.inputs });
  };

  const focusNextError = () => {
    if (state.context.validationErrors.length === 0) return;
    const next = state.context.validationErrors[errorIndex % state.context.validationErrors.length];
    setErrorIndex((prev) => prev + 1);
    if (!next.nodeId) return;
    if (next.pinKey) {
      send({ type: "FOCUS_PIN", nodeId: next.nodeId, pinKey: next.pinKey });
    } else {
      send({ type: "SELECT_NODE", nodeId: next.nodeId });
    }
  };

  const paletteActions = useMemo(() => {
    const addActions = registry.listTypes().map((type) => ({
      id: `add-${type}`,
      title: `Add Node: ${type}`,
      keywords: type,
      run: () => {
        const node = createNodeInstance(type, registry, graphCenter);
        addNode(node);
      },
    }));
    return [
      ...addActions,
      {
        id: "duplicate-selection",
        title: "Duplicate Selection",
        run: () => {
          const duplicated = duplicateSelection(graphRef.current, selectedNodeIds);
          if (!duplicated) return;
          let next = graphRef.current;
          pendingHistoryRef.current = true;
          for (const node of duplicated.nodes) {
            const command = { type: "ADD_NODE", node } as const;
            next = applyCommand(next, command);
            sync.sendCommand(command);
          }
          for (const edge of duplicated.edges) {
            const command = { type: "CONNECT", edge } as const;
            next = applyCommand(next, command);
            sync.sendCommand(command);
          }
          updateGraph(next);
          setSelectedNodeIds(duplicated.nodes.map((node) => node.id));
          send({ type: "SELECT_NODE", nodeId: duplicated.nodes[0]?.id ?? null });
        },
      },
      {
        id: "auto-layout",
        title: "Auto Layout",
        run: () => applyCommands(autoLayoutGraph(graphRef.current)),
      },
      {
        id: "focus-error",
        title: "Focus Next Error",
        run: () => focusNextError(),
      },
      {
        id: "run-graph",
        title: "Run Graph",
        run: () => runtime.run(),
      },
      {
        id: "step-graph",
        title: "Step Graph",
        run: () => runtime.step(),
      },
      {
        id: "open-json",
        title: "Open JSON Tab",
        run: () => setTab("json"),
      },
      {
        id: "open-graph",
        title: "Open Graph Tab",
        run: () => setTab("graph"),
      },
    ];
  }, [graphCenter, runtime, setTab, registry, errorIndex, addNode, applyCommands, focusNextError]);

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

  const isEditableTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMac = window.navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (isEditableTarget(event.target)) return;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery("");
        return;
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        focusNextError();
        return;
      }
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const allIds = graphRef.current.nodes.map((node) => node.id);
        setSelectedNodeIds(allIds);
        send({ type: "SELECT_NODE", nodeId: allIds[0] ?? null });
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        if (selectedNodeIds.length === 0) return;
        const baseStep = snapToGrid ? 20 : 10;
        const step = event.shiftKey ? baseStep * 5 : baseStep;
        const offset = {
          x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
          y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
        };
        const commands = selectedNodeIds.map((nodeId) => {
          const node = graphRef.current.nodes.find((n) => n.id === nodeId);
          if (!node) return null;
          return {
            type: "MOVE_NODE",
            nodeId,
            pos: { x: node.pos.x + offset.x, y: node.pos.y + offset.y },
          } as const;
        }).filter(Boolean) as Parameters<typeof applyCommand>[1][];
        applyCommands(commands);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelectedNodes();
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        clipboardRef.current = copySelection(graphRef.current, selectedNodeIds);
        return;
      }
      if (mod && event.key.toLowerCase() === "x") {
        event.preventDefault();
        clipboardRef.current = copySelection(graphRef.current, selectedNodeIds);
        deleteSelectedNodes();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        if (!clipboardRef.current) return;
        const payload = clipboardRef.current;
        const pasted = pasteSelection(payload, defaultPasteOffset);
        let next = graphRef.current;
        pendingHistoryRef.current = true;
        for (const node of pasted.nodes) {
          const command = { type: "ADD_NODE", node } as const;
          next = applyCommand(next, command);
          sync.sendCommand(command);
        }
        for (const edge of pasted.edges) {
          const command = { type: "CONNECT", edge } as const;
          next = applyCommand(next, command);
          sync.sendCommand(command);
        }
        updateGraph(next);
        setSelectedNodeIds(pasted.nodes.map((node) => node.id));
        send({ type: "SELECT_NODE", nodeId: pasted.nodes[0]?.id ?? null });
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const duplicated = duplicateSelection(graphRef.current, selectedNodeIds);
        if (!duplicated) return;
        let next = graphRef.current;
        pendingHistoryRef.current = true;
        for (const node of duplicated.nodes) {
          const command = { type: "ADD_NODE", node } as const;
          next = applyCommand(next, command);
          sync.sendCommand(command);
        }
        for (const edge of duplicated.edges) {
          const command = { type: "CONNECT", edge } as const;
          next = applyCommand(next, command);
          sync.sendCommand(command);
        }
        updateGraph(next);
        setSelectedNodeIds(duplicated.nodes.map((node) => node.id));
        send({ type: "SELECT_NODE", nodeId: duplicated.nodes[0]?.id ?? null });
        return;
      }
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
  }, [selectedNodeIds]);

  return (
    <div className="app" data-testid="studio-root">
      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        actions={paletteActions}
        onQueryChange={setPaletteQuery}
        onClose={() => setPaletteOpen(false)}
      />
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
              runtime.prepareRun({ inputs: graphInputs, presetId: selectedPresetId ?? undefined, seed: seedRef.current++ });
              runtime.step();
            }}
          >
            Step
          </button>
          <button
            className="button primary"
            onClick={() => {
              runtime.prepareRun({ inputs: graphInputs, presetId: selectedPresetId ?? undefined, seed: seedRef.current++ });
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
              selectedNodeIds={selectedNodeIds}
              focusedPin={state.context.focusedPin}
              validationErrors={state.context.validationErrors}
              runningNodeId={snapshot.currentNodeId}
              breakpoints={snapshot.breakpoints}
              suppressDrag={isRemoteSyncing}
              snapToGrid={snapToGrid}
              onToggleSnap={() => setSnapToGrid((prev) => !prev)}
              onAlign={(mode) => applyCommands(alignNodes(graphRef.current, selectedNodeIds, mode))}
              onDistribute={(mode) =>
                applyCommands(distributeNodes(graphRef.current, selectedNodeIds, mode))
              }
              onAutoLayout={() => applyCommands(autoLayoutGraph(graphRef.current))}
              onSelectNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
              onSelectNodes={(nodeIds) => {
                setSelectedNodeIds(nodeIds);
                send({ type: "SELECT_NODE", nodeId: nodeIds[0] ?? null });
              }}
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
              presets={presets.map((preset) => ({ id: preset.id, title: preset.title }))}
              selectedPresetId={selectedPresetId}
              onSelectPreset={(presetId) => setSelectedPresetId(presetId)}
              onNext={() => runtime.dispatchNext()}
              onChoose={(choiceKey) => runtime.dispatchChoice(choiceKey)}
            />
            <TracePanel trace={snapshot.trace} runMeta={snapshot.runMeta} />
            <LintPanel
              issues={lintIssues}
              onFix={(issue) => {
                if (!issue.fix) return;
                applyCommands(issue.fix.commands);
              }}
              onFocusNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
            />
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
            presets={presets}
            onApplyPresets={applyPresets}
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

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
  }, [sync.requestSnapshot]);

  const handleCommand = (command: Parameters<typeof applyCommand>[1]) => {
    updateGraph(applyCommand(graphRef.current, command));
    sync.sendCommand(command);
  };

  return (
    <CanvasOnly
      graph={graph}
      registry={registry}
      selectedNodeId={state.context.selectedNodeId}
      selectedNodeIds={selectedNodeIds}
      focusedPin={state.context.focusedPin}
      validationErrors={state.context.validationErrors}
      runningNodeId={null}
      breakpoints={[]}
      suppressDrag={isRemoteSyncing}
      snapToGrid
      onSelectNode={(nodeId) => {
        send({ type: "SELECT_NODE", nodeId });
        setSelectedNodeIds(nodeId ? [nodeId] : []);
      }}
      onSelectNodes={(nodeIds) => {
        setSelectedNodeIds(nodeIds);
        send({ type: "SELECT_NODE", nodeId: nodeIds[0] ?? null });
      }}
      onCommand={handleCommand}
      onBackToStudio={() => {
        if (typeof window === "undefined") return;
        window.location.href = "/";
      }}
    />
  );
};
