import React, { useEffect, useMemo, useRef } from "react";
import { NodeEditor, type BaseSchemes } from "rete";
import { AreaExtensions, AreaPlugin } from "rete-area-plugin";
import { ReactPlugin, Presets } from "rete-react-plugin";
import { ClassicFlow, ConnectionPlugin, getSourceTarget } from "rete-connection-plugin";
import { createRoot } from "react-dom/client";
import type { Graph } from "../../engine/ir";
import type { Registry } from "../../engine/registry";
import type { Command } from "../commands";
import { buildReteConnection, graphToRete, reteMoveCommand } from "./mapping";
import type { ValidationError } from "../../engine/validator";
import { buildErrorMap } from "../errors";
import { canConnectEndpoints, connectionToEdge } from "./connectionRules";
import type { ReteNodeData } from "./types";
import { NodeView } from "./nodes";
import "./rete.css";

export type ReteCanvasProps = {
  graph: Graph;
  registry: Registry;
  selectedNodeId: string | null;
  focusedPin: { nodeId: string; pinKey: string } | null;
  validationErrors: ValidationError[];
  runningNodeId: string | null;
  breakpoints: string[];
  suppressDrag?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  onCommand: (command: Command) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
};

type Schemes = BaseSchemes & {
  Node: ReteNodeData;
};

export const ReteCanvas = ({
  graph,
  registry,
  selectedNodeId,
  focusedPin,
  validationErrors,
  runningNodeId,
  breakpoints,
  suppressDrag = false,
  snapToGrid = true,
  gridSize = 20,
  onCommand,
  onSelectNode,
  onSelectNodes,
}: ReteCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<NodeEditor<Schemes> | null>(null);
  const areaRef = useRef<AreaPlugin<Schemes> | null>(null);
  const nodesRef = useRef<Map<string, ClassicPreset.Node<ReteNodeData>>>(new Map());
  const syncingRef = useRef(false);
  const syncingConnectionsRef = useRef(false);
  const suppressDragRef = useRef(suppressDrag);
  const dragLockRef = useRef<Map<string, number>>(new Map());
  const dragLockMsRef = useRef(120);
  const graphRef = useRef(graph);
  const logRef = useRef({ init: false });
  const syncTokenRef = useRef(0);
  const selectorRef = useRef(AreaExtensions.selector());

  const debugLog = (label: string, data?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (!enabled) return;
    console.info(label, data ?? {});
  };

  const errorMap = useMemo(() => buildErrorMap(validationErrors), [validationErrors]);
  const reteData = useMemo(
    () =>
      graphToRete(
        graph,
        registry,
        errorMap,
        selectedNodeId && focusedPin ? focusedPin : null,
        runningNodeId,
        breakpoints
      ),
    [breakpoints, errorMap, focusedPin, graph, registry, runningNodeId, selectedNodeId]
  );

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    suppressDragRef.current = suppressDrag;
  }, [suppressDrag]);

  const nowMs = () => Date.now();
  const snap = (value: number) => (snapToGrid ? Math.round(value / gridSize) * gridSize : value);

  useEffect(() => {
    if (!containerRef.current) return;
    if (editorRef.current) return;

    if (!logRef.current.init) {
      logRef.current.init = true;
      debugLog("rete:init");
    }

    const editor = new NodeEditor<Schemes>();
    const area = new AreaPlugin<Schemes>(containerRef.current);
    const reactRender = new ReactPlugin<Schemes>({ createRoot });
    const connection = new ConnectionPlugin<Schemes>();

    connection.addPreset(
      () =>
        new ClassicFlow<Schemes>({
          canMakeConnection: (from, to) => {
            const pair = getSourceTarget(from, to);
            if (!pair) return false;
            const [source, target] = pair;
            return canConnectEndpoints(
              graphRef.current,
              registry,
              { nodeId: source.nodeId, pinKey: source.key, side: "output" },
              { nodeId: target.nodeId, pinKey: target.key, side: "input" }
            ).ok;
          },
          makeConnection: (from, to, context) => {
            const pair = getSourceTarget(from, to);
            if (!pair) return false;
            const [source, target] = pair;
            const decision = canConnectEndpoints(
              graphRef.current,
              registry,
              { nodeId: source.nodeId, pinKey: source.key, side: "output" },
              { nodeId: target.nodeId, pinKey: target.key, side: "input" }
            );
            if (!decision.ok) return false;
            void context.editor.addConnection({
              id: `${source.nodeId}-${source.key}-${target.nodeId}-${target.key}-${Date.now()}`,
              source: source.nodeId,
              sourceOutput: source.key,
              target: target.nodeId,
              targetInput: target.key,
            });
            return true;
          },
        })
    );

    reactRender.addPreset(
      Presets.classic.setup<Schemes, Presets.classic.ReactArea2D<Schemes>>({
        customize: {
          node: () => NodeView,
        },
      })
    );

    editor.use(area);
    area.use(reactRender);
    area.use(connection);
    AreaExtensions.selectableNodes(area, selectorRef.current, {
      accumulating: AreaExtensions.accumulateOnCtrl(),
    });

    const notifySelection = () => {
      if (!onSelectNodes) return;
      const selected = Array.from(selectorRef.current.entities.keys());
      onSelectNodes(selected);
    };

    area.addPipe((context) => {
      /* istanbul ignore if -- sync guard is exercised only during live editor updates */
      if (syncingRef.current) {
        debugLog("rete:pipe:skip", { type: context.type });
        return context;
      }
      if (suppressDragRef.current && context.type === "nodedragged") {
        debugLog("rete:pipe:skip", { type: context.type, reason: "suppressDrag" });
        return context;
      }
      if (context.type === "nodepicked") {
        onSelectNode(context.data.id);
        notifySelection();
      }
      if (context.type === "pointerup") {
        notifySelection();
      }
      if (context.type === "nodedragged") {
        const node = context.data;
        if (node?.id) {
          const entities = selectorRef.current.entities;
          const selectedIds = Array.from(entities ? entities.keys() : []);
          const targetIds = selectedIds.length > 0 ? selectedIds : [node.id];
          for (const id of targetIds) {
            dragLockRef.current.set(id, nowMs());
            const view = area.nodeViews.get(id);
            if (view) {
              const pos = { x: snap(view.position.x), y: snap(view.position.y) };
              onCommand(reteMoveCommand(id, pos));
            }
          }
        }
      }
      return context;
    });

    editor.addPipe((context) => {
      const skipReason = shouldSkipEditorPipe(
        syncingConnectionsRef.current,
        syncingRef.current
      );
      if (skipReason) {
        debugLog("rete:pipe:skip", { type: context.type, reason: skipReason });
        return context;
      }
      if (context.type === "connectioncreated") {
        const edge = connectionToEdge(context.data);
        const hasEdge = graphRef.current.edges.some(
          (item) =>
            item.from.nodeId === edge.from.nodeId &&
            item.from.pinKey === edge.from.pinKey &&
            item.to.nodeId === edge.to.nodeId &&
            item.to.pinKey === edge.to.pinKey
        );
        if (hasEdge) {
          return context;
        }
        onCommand({ type: "CONNECT", edge });
      }
      if (context.type === "connectionremoved") {
        const hasEdge = graphRef.current.edges.some((item) => item.id === context.data.id);
        if (!hasEdge) {
          return context;
        }
        onCommand({ type: "DISCONNECT", edgeId: context.data.id });
      }
      return context;
    });

    editorRef.current = editor;
    areaRef.current = area;
    if (typeof window !== "undefined") {
      const testEnabled = (window as unknown as { __RETE_TEST__?: boolean }).__RETE_TEST__;
      if (testEnabled) {
        (window as unknown as { __RETE_TEST_API__?: Record<string, unknown> }).__RETE_TEST_API__ = {
          connect: (from: { nodeId: string; pinKey: string }, to: { nodeId: string; pinKey: string }) => {
            onCommand({
              type: "CONNECT",
              edge: {
                id: `${from.nodeId}-${from.pinKey}-${to.nodeId}-${to.pinKey}-${Date.now()}`,
                from,
                to,
              },
            });
          },
          move: (nodeId: string, pos: { x: number; y: number }) => {
            onCommand(reteMoveCommand(nodeId, pos));
          },
          select: (nodeId: string) => {
            onSelectNode(nodeId);
          },
        };
      }
    }

    return () => {
      syncingRef.current = true;
      area.destroy();
      if (typeof (editor as unknown as { destroy?: () => void }).destroy === "function") {
        (editor as unknown as { destroy: () => void }).destroy();
      }
    };
  }, [onCommand, onSelectNode, registry]);

  useEffect(() => {
    const editor = editorRef.current;
    const area = areaRef.current;
    if (!editor || !area) return;

    const token = syncTokenRef.current + 1;
    syncTokenRef.current = token;

    debugLog("rete:sync:start", {
      nodes: reteData.nodes.size,
      edges: graph.edges.length,
      selectedNodeId,
      focusedPin,
    });
    syncingRef.current = true;
  const lockNow = nowMs();
  const lockMs = dragLockMsRef.current;
  pruneDragLocks(dragLockRef.current, lockNow, lockMs);
    const existingIds = new Set(nodesRef.current.keys());
    for (const [id, node] of reteData.nodes.entries()) {
      const existing = nodesRef.current.get(id);
      const isLocked = isDragLocked(dragLockRef.current, id, lockNow, lockMs);
      if (!existing) {
        editor.addNode(node);
        if (!isLocked) {
          area.translate(id, node.pos);
        }
        nodesRef.current.set(id, node);
      } else {
        Object.assign(existing, {
          label: node.label,
          inputsMeta: node.inputsMeta,
          outputsMeta: node.outputsMeta,
          nodeErrors: node.nodeErrors,
          pinErrors: node.pinErrors,
          focusedPinKey: node.focusedPinKey,
          isRunning: node.isRunning,
          hasBreakpoint: node.hasBreakpoint,
        });
        if (!isLocked) {
          area.translate(id, node.pos);
        }
        area.update("node", id);
      }
      existingIds.delete(id);
    }

    for (const stale of existingIds) {
      editor.removeNode(stale);
      nodesRef.current.delete(stale);
    }

    const syncConnections = async () => {
      syncingConnectionsRef.current = true;
      const safeRemoveConnection = async (id: string) => {
        try {
          await editor.removeConnection(id);
        } catch {
          // Connection might already be removed by plugin interactions.
        }
      };
      const existingConnections = editor.getConnections();
      const existingIds = new Set(existingConnections.map((conn) => conn.id));
      const desiredIds = new Set(graph.edges.map((edge) => edge.id));

      for (const conn of existingConnections) {
        if (!desiredIds.has(conn.id)) {
          await safeRemoveConnection(conn.id);
          if (syncTokenRef.current !== token) return;
        }
      }

      for (const edge of graph.edges) {
        if (syncTokenRef.current !== token) return;
        if (existingIds.has(edge.id)) continue;
        const sourceNode = nodesRef.current.get(edge.from.nodeId);
        const targetNode = nodesRef.current.get(edge.to.nodeId);
        if (!sourceNode || !targetNode) continue;
        const def = registry.get(sourceNode.type, sourceNode.version) ?? registry.getLatest(sourceNode.type);
        const pin = def?.outputs.find((output) => output.key === edge.from.pinKey);
        const isExec = pin?.kind === "exec";
        await editor.addConnection(buildReteConnection(edge, sourceNode, targetNode, isExec));
      }
      if (syncTokenRef.current !== token) return;
      const finalizeSync = () => {
        if (syncTokenRef.current !== token) return;
        syncingRef.current = false;
        syncingConnectionsRef.current = false;
      };
      if (process.env.NODE_ENV === "test") {
        finalizeSync();
      } else if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => queueMicrotask(finalizeSync));
      } else {
        setTimeout(finalizeSync, 0);
      }
      debugLog("rete:sync:end");
    };

    void syncConnections();
  }, [graph.edges, registry, reteData]);

  return <div className="rete-canvas" data-testid="canvas-root" ref={containerRef} />;
};

export const isDragLocked = (
  lockMap: Map<string, number>,
  nodeId: string,
  now: number,
  lockMs: number
) => {
  const last = lockMap.get(nodeId);
  if (last === undefined) return false;
  return now - last < lockMs;
};

export const shouldSkipEditorPipe = (syncingConnections: boolean, syncing: boolean) => {
  if (syncingConnections) return "syncingConnections";
  if (syncing) return "syncing";
  return null;
};

export const pruneDragLocks = (
  lockMap: Map<string, number>,
  now: number,
  lockMs: number
) => {
  let removed = 0;
  for (const [id, ts] of lockMap.entries()) {
    if (now - ts > lockMs * 2) {
      lockMap.delete(id);
      removed += 1;
    }
  }
  return removed;
};
