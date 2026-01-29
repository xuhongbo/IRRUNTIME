// 文件说明：自动补充文件级注释，描述模块职责与用途

// Rete 画布封装：管理节点渲染、连线与交互事件
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ClassicPreset, NodeEditor, type BaseSchemes } from "rete";
import { AreaExtensions, AreaPlugin, Drag } from "rete-area-plugin";
import { ReactPlugin, Presets } from "rete-react-plugin";
import { ClassicFlow, ConnectionPlugin, getSourceTarget } from "rete-connection-plugin";
import { createRoot } from "react-dom/client";
import type { Graph } from "../../engine/ir";
import type { Registry } from "../../engine/registry";
import type { Command } from "../commands";
import { buildReteConnection, buildReteNode, reteMoveCommand } from "./mapping";
import type { ValidationError } from "../../engine/validator";
import { buildErrorMap } from "../errors";
import { canConnectEndpoints, connectionToEdge } from "./connectionRules";
import type { ReteNodeData } from "./types";
import { NodeView } from "./nodes";
import "./rete.css";
import { resolveNodeDefinition } from "../../engine/contract";

// --- Helpers ---

// 多选快捷键判断
export const isMultiSelectModifier = (event: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) =>
  Boolean(event.ctrlKey || event.metaKey || event.shiftKey);

// 判断是否点击在背景区域
export const isBackgroundPointer = (event: { target: EventTarget | null }) => {
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.closest !== "function") return true;
  return !target.closest(".rete-node");
};

// 判断选中集合是否一致（用于避免重复更新）
export const selectionMatches = (entities: Map<string, unknown>, selectedNodeIds: string[]) => {
  const normalize = (value: string) => (value.startsWith("node_") ? value.slice(5) : value);
  if (entities.size !== selectedNodeIds.length) return false;
  const entityIds = new Set(Array.from(entities.keys()).map((id) => normalize(id)));
  for (const id of selectedNodeIds) {
    if (!entityIds.has(id)) return false;
  }
  return true;
};

// 拖拽锁：避免拖拽事件重复触发
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

// 编辑器管线跳过逻辑：用于同步过程
export const shouldSkipEditorPipe = (syncingConnections: boolean, syncing: boolean) => {
  if (syncingConnections) return "syncingConnections";
  if (syncing) return "syncing";
  return null;
};

// 清理过期拖拽锁
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

// 生成端口签名，用于检测定义变化
const buildPinsSignature = (pins: { key: string; kind?: string; dataType?: string; label?: string }[]) =>
  pins
    .map((pin) => `${pin.key}:${pin.kind ?? ""}:${pin.dataType ?? ""}:${pin.label ?? ""}`)
    .join("|");

// 生成节点签名，用于比较节点结构变化
const buildNodeSignature = (
  node: Graph["nodes"][number],
  resolved: { def: { title?: string }; inputs: { key: string; kind?: string; dataType?: string; label?: string }[]; outputs: { key: string; kind?: string; dataType?: string; label?: string }[] }
) => {
  const inputsSig = buildPinsSignature(resolved.inputs);
  const outputsSig = buildPinsSignature(resolved.outputs);
  const title = resolved.def.title ?? node.type;
  return `${node.type}@${node.version}:${title}:${inputsSig}::${outputsSig}`;
};

// 事件引用封装，避免闭包捕获旧函数
const useEvent = <T extends (...args: never[]) => void>(handler: T) => {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Parameters<T>) => handlerRef.current(...args), []);
};

// --- Component ---

// 画布组件参数
export type ReteCanvasProps = {
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
  gridSize?: number;
  onCommand: (command: Command) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
};

type Schemes = BaseSchemes & {
  Node: ReteNodeData;
};

// Rete 画布组件：负责节点、连线与交互
export const ReteCanvas = ({
  graph,
  registry,
  selectedNodeId,
  selectedNodeIds = [],
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
  const selectableRef = useRef<ReturnType<typeof AreaExtensions.selectableNodes> | null>(null);
  const suppressDragRef = useRef(suppressDrag);
  const dragLockRef = useRef<Map<string, number>>(new Map());
  const dragLockMsRef = useRef(120);
  const graphRef = useRef(graph);
  const registryRef = useRef(registry);
  const logRef = useRef({ init: false });
  const syncTokenRef = useRef(0);
  const selectorRef = useRef(AreaExtensions.selector());
  const onCommandEvent = useEvent(onCommand);
  const onSelectNodeEvent = useEvent(onSelectNode);
  const onSelectNodesEvent = useEvent((nodeIds: string[]) => onSelectNodes?.(nodeIds));

  const debugLog = (label: string, data?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (!enabled) return;
    console.info(label, data ?? {});
  };

  const errorMap = useMemo(() => buildErrorMap(validationErrors), [validationErrors]);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  useEffect(() => {
    suppressDragRef.current = suppressDrag;
  }, [suppressDrag]);

  const nowMs = () => Date.now();
  const snap = (value: number) => (snapToGrid ? Math.round(value / gridSize) * gridSize : value);

  useEffect(() => {
    if (!containerRef.current) return;
    if (editorRef.current) return;
    containerRef.current.innerHTML = "";

    if (!logRef.current.init) {
      logRef.current.init = true;
      debugLog("rete:init");
    }

    const editor = new NodeEditor<Schemes>();
    const area = new AreaPlugin<Schemes>(containerRef.current);
    const reactRender = new ReactPlugin<Schemes>({ createRoot });
    const connection = new ConnectionPlugin<Schemes>();
    
    // Explicit Drag Handler
    const dragHandler = new Drag({
      down: (event) => event.button === 0 && isBackgroundPointer(event),
      move: () => true,
    });

    connection.addPreset(
      () =>
        new ClassicFlow<Schemes>({
          canMakeConnection: (from, to) => {
            const pair = getSourceTarget(from, to);
            if (!pair) return false;
            const [source, target] = pair;
            return canConnectEndpoints(
              graphRef.current,
              registryRef.current,
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
              registryRef.current,
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
    area.area.setDragHandler(dragHandler);

    // Extensions
    AreaExtensions.simpleNodesOrder(area);
    selectableRef.current = AreaExtensions.selectableNodes(area, selectorRef.current, {
      accumulating: AreaExtensions.accumulateOnCtrl(),
    });

    const normalizeSelectionId = (value: string) => (value.startsWith("node_") ? value.slice(5) : value);
    const notifySelection = (fallbackId?: string) => {
      const selected = Array.from(selectorRef.current.entities.keys()).map((id) =>
        normalizeSelectionId(id)
      );
      if (selected.length === 0 && fallbackId) {
        onSelectNodesEvent([normalizeSelectionId(fallbackId)]);
        return;
      }
      if (selected.length === 0) {
        return;
      }
      onSelectNodesEvent(selected);
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
      if (context.type === "pointerdown") {
        const event = context.data.event;
        if (event.button === 0 && isBackgroundPointer(event)) {
          onSelectNodeEvent(null);
          onSelectNodesEvent([]);
          if (typeof selectorRef.current.unselectAll === "function") {
            void selectorRef.current.unselectAll();
          }
        }
      }
      if (context.type === "nodepicked") {
        const pickedId = context.data.id;
        onSelectNodeEvent(pickedId);
        notifySelection(pickedId);
      }
      if (context.type === "nodeselected") {
        const pickedId = context.data.id;
        onSelectNodeEvent(pickedId);
        notifySelection(pickedId);
      }
      if (context.type === "nodeunselected") {
        notifySelection(selectedNodeId ?? undefined);
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
              onCommandEvent(reteMoveCommand(id, pos));
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
        onCommandEvent({ type: "CONNECT", edge });
      }
      if (context.type === "connectionremoved") {
        const hasEdge = graphRef.current.edges.some((item) => item.id === context.data.id);
        if (!hasEdge) {
          return context;
        }
        onCommandEvent({ type: "DISCONNECT", edgeId: context.data.id });
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
            onCommandEvent({
              type: "CONNECT",
              edge: {
                id: `${from.nodeId}-${from.pinKey}-${to.nodeId}-${to.pinKey}-${Date.now()}`,
                from,
                to,
              },
            });
          },
          move: (nodeId: string, pos: { x: number; y: number }) => {
            onCommandEvent(reteMoveCommand(nodeId, pos));
          },
          select: (nodeId: string) => {
            onSelectNodeEvent(nodeId);
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
      editorRef.current = null;
      areaRef.current = null;
      nodesRef.current.clear();
    };
  }, [onCommandEvent, onSelectNodeEvent, onSelectNodesEvent]);

  useEffect(() => {
    const editor = editorRef.current;
    const area = areaRef.current;
    if (!editor || !area) return;

    const token = syncTokenRef.current + 1;
    syncTokenRef.current = token;

    debugLog("rete:sync:start", {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      selectedNodeId,
      focusedPin,
    });
    syncingRef.current = true;

    const syncNodes = async () => {
      const lockNow = nowMs();
      const lockMs = dragLockMsRef.current;
      pruneDragLocks(dragLockRef.current, lockNow, lockMs);
      const existingIds = new Set(nodesRef.current.keys());

      for (const node of graph.nodes) {
        if (syncTokenRef.current !== token) return;
        const resolved = resolveNodeDefinition(node, graph, registryRef.current);
        if (!resolved) continue;
        const signature = buildNodeSignature(node, resolved);
        const existing = nodesRef.current.get(node.id) as (ClassicPreset.Node<ReteNodeData> & { __sig?: string }) | undefined;
        const isLocked = isDragLocked(dragLockRef.current, node.id, lockNow, lockMs);
        const focusedPinKey = selectedNodeId && focusedPin?.nodeId === node.id ? focusedPin.pinKey : null;
        const nodeErrors = errorMap.get(node.id)?.nodeErrors ?? [];
        const pinErrors = errorMap.get(node.id)?.pinErrors ?? {};
        const isRunning = runningNodeId === node.id;
        const hasBreakpoint = breakpoints.includes(node.id);
        const label = resolved.def.title ?? node.type;
        const shouldRebuild = !existing || existing.__sig !== signature;

        if (shouldRebuild) {
          if (existing) {
            try {
              await editor.removeNode(node.id);
            } catch {
              // 节点可能已被移除
            }
            nodesRef.current.delete(node.id);
          }
          const reteNode = buildReteNode(node, graph, registryRef.current);
          reteNode.nodeErrors = nodeErrors;
          reteNode.pinErrors = pinErrors;
          reteNode.focusedPinKey = focusedPinKey;
          reteNode.isRunning = isRunning;
          reteNode.hasBreakpoint = hasBreakpoint;
          (reteNode as typeof reteNode & { __sig?: string }).__sig = signature;
          await editor.addNode(reteNode);
          if (!isLocked) {
            await area.translate(node.id, node.pos);
          }
          nodesRef.current.set(node.id, reteNode);
        } else if (existing) {
          const prevPos = existing.pos ?? { x: 0, y: 0 };
          const posChanged = prevPos.x !== node.pos.x || prevPos.y !== node.pos.y;
          const metaChanged =
            existing.label !== label ||
            existing.focusedPinKey !== focusedPinKey ||
            existing.isRunning !== isRunning ||
            existing.hasBreakpoint !== hasBreakpoint ||
            existing.nodeErrors !== nodeErrors ||
            existing.pinErrors !== pinErrors;

          Object.assign(existing, {
            label,
            inputsMeta: resolved.inputs,
            outputsMeta: resolved.outputs,
            nodeErrors,
            pinErrors,
            focusedPinKey,
            isRunning,
            hasBreakpoint,
            pos: node.pos,
          });
          if (posChanged && !isLocked) {
            await area.translate(node.id, node.pos);
          }
          if (metaChanged) {
            await area.update("node", node.id);
          }
        }
        existingIds.delete(node.id);
      }

      for (const stale of existingIds) {
        try {
          await editor.removeNode(stale);
        } catch {
          // 节点可能已被移除
        }
        nodesRef.current.delete(stale);
      }
    };

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
        const def = registryRef.current.get(sourceNode.type, sourceNode.version) ?? registryRef.current.getLatest(sourceNode.type);
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

    void (async () => {
      await syncNodes();
      await syncConnections();
    })();
  }, [breakpoints, errorMap, focusedPin, graph, runningNodeId, selectedNodeId]);

  useEffect(() => {
    const selector = selectorRef.current;
    const selectable = selectableRef.current;
    if (!selector || !selectable) return;
    if (!Array.isArray(selectedNodeIds)) return;
    if (selectionMatches(selector.entities, selectedNodeIds)) return;
    const syncSelection = async () => {
      if (typeof selector.unselectAll === "function") {
        await selector.unselectAll();
      }
      for (const [index, id] of selectedNodeIds.entries()) {
        await selectable.select(id, index > 0);
      }
    };
    void syncSelection();
  }, [selectedNodeIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const findNodeId = (event: Event) => {
      const path = (event.composedPath?.() ?? []) as HTMLElement[];
      const nodeEl = path.find((el) => el?.classList?.contains?.("rete-node")) as HTMLElement | undefined;
      if (!nodeEl) return null;
      const testId = nodeEl.getAttribute("data-testid") ?? "";
      if (!testId.startsWith("node-")) return null;
      return testId.slice("node-".length) || null;
    };
    const handlePointerDown = (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey) return;
      const nodeId = findNodeId(event);
      if (!nodeId) return;
      if (typeof window !== "undefined") {
        const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
        if (enabled) {
          console.info("rete:select", nodeId);
        }
      }
      onSelectNodeEvent(nodeId);
      onSelectNodesEvent([nodeId]);
    };
    container.addEventListener("pointerdown", handlePointerDown, true);
    return () => container.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onSelectNodeEvent, onSelectNodesEvent]);

  return <div className="rete-canvas" data-testid="canvas-root" ref={containerRef} />;
};
