// 文件说明：自动补充文件级注释，描述模块职责与用途

// 应用入口与主界面组装
import { useEffect, useMemo, useRef, useState } from "react";
import { registry } from "./engine/registry";
import type { Graph } from "./engine/ir";
import { useRuntime } from "./ui/useRuntime";
import { GraphViewer } from "./ui/GraphViewer";
import { Inspector } from "./ui/Inspector";
import { Runner } from "./ui/Runner";
import { TracePanel } from "./ui/TracePanel";
import { VariablesPanel } from "./ui/VariablesPanel";
import { JsonTab } from "./ui/JsonTab";
import { GraphSettings } from "./ui/GraphSettings";
import { useStudio } from "./studio/useStudio";
import { setRuntimeState } from "./studio/ecs";
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
import { createNodeInstance, listFlowPaletteItems } from "./studio/nodeFactory";
import { CommandPalette } from "./ui/CommandPalette";

// MUI Imports
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { theme } from "./theme";

const DRAWER_WIDTH = 280;
const RIGHT_DRAWER_WIDTH = 320;

// 应用入口：根据路径切换为画布纯视图或完整编辑器
export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname === "/canvas") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CanvasOnlyApp />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StudioApp />
    </ThemeProvider>
  );
}

// 主编辑器应用：负责编辑、运行、校验、同步与面板组织
const StudioApp = () => {
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("app:render");
    }
  }
  // 编辑器状态与操作入口
  const { state, send, updateGraph, ecs } = useStudio();
  const graph = state.context.graph;
  const graphRef = useRef(graph);
  // 运行时快照与运行指令发送
  const { snapshot, send: runtimeSend } = useRuntime(graph, registry);
  const [tab, setTab] = useState<"studio" | "json" | "graph">("studio");
  const graphCenter = useMemo(() => getGraphCenter(graph), [graph]);
  const pendingSnapshotRef = useRef(false);
  const pendingApplyJsonRef = useRef(false);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);
  const [graphInputs, setGraphInputs] = useState<Record<string, unknown>>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [errorIndex, setErrorIndex] = useState(0);
  const [rightTab, setRightTab] = useState<"trace" | "vars">("trace");
  const historyRef = useRef(createHistoryState(80));
  const pendingHistoryRef = useRef(false);
  const historyActionRef = useRef<"undo" | "redo" | "remote" | null>(null);
  const clipboardRef = useRef<ReturnType<typeof copySelection> | null>(null);
  const seedRef = useRef(1);
  const contract = useMemo(() => normalizeContract(graph.contract), [graph.contract]);
  const presets = useMemo(() => graph.presets ?? [], [graph.presets]);
  const lintIssues = useMemo(() => lintGraph(graph), [graph]);

  // ... (Hook logic remains unchanged)
  // 根据契约生成默认输入（用于运行面板的初始值）
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

  // 维护 graph 引用，避免闭包引用过期
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  // 将运行时快照同步到 ECS 状态，便于渲染节点状态
  useEffect(() => {
    setRuntimeState(ecs, snapshot);
  }, [ecs, snapshot]);

  // 当契约变化时重建输入默认值
  useEffect(() => {
    setGraphInputs((current) => buildDefaultInputs(contract, current));
  }, [contract]);

  // 维护预设选择的有效性
  useEffect(() => {
    if (presets.length === 0) {
      setSelectedPresetId(null);
      return;
    }
    if (!selectedPresetId || !presets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(presets[0]?.id ?? null);
    }
  }, [presets, selectedPresetId]);

  // 预设变化时应用预设输入
  useEffect(() => {
    applyPresetInputs(selectedPresetId);
  }, [selectedPresetId]);

  // 在本地编辑时推入历史栈，远程同步不计入历史
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

  // 跨标签页同步：接收远程图或命令并应用
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

  // 本地变更后发出快照同步
  useEffect(() => {
    if (pendingSnapshotRef.current) {
      sync.sendSnapshot(graph);
      pendingSnapshotRef.current = false;
    }
  }, [graph, sync]);

  // JSON 视图应用时发送同步命令
  useEffect(() => {
    if (!pendingApplyJsonRef.current) return;
    pendingApplyJsonRef.current = false;
    sync.sendCommand({ type: "APPLY_JSON", graph });
  }, [graph, sync]);

  useEffect(() => {
    if (!state.context.jsonError) return;
    pendingApplyJsonRef.current = false;
  }, [state.context.jsonError]);

  const statusBlock = useMemo(() => {
    switch (state.context.validationStatus) {
      case "validating":
        return <Chip label="校验中..." color="warning" size="small" />;
      case "valid":
        return <Chip label="校验通过" color="success" size="small" />;
      case "invalid":
        return (
          <Chip
            label={`${state.context.validationErrors.length} 错误`}
            color="error"
            size="small"
            onClick={() => focusNextError()}
          />
        );
      default:
        return <Chip label="空闲" size="small" />;
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

  const applyGraphReplace = (nextGraph: Graph) => {
    const command = { type: "APPLY_JSON", graph: nextGraph } as const;
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
    if (next.pinId) {
      send({ type: "FOCUS_PIN", nodeId: next.nodeId, pinKey: next.pinId });
    } else {
      send({ type: "SELECT_NODE", nodeId: next.nodeId });
    }
  };

  const paletteActions = useMemo(() => {
    const addActions = listFlowPaletteItems(registry).map((item) => ({
      id: `add-${item.type}`,
      title: `添加节点：${item.title}`,
      keywords: `${item.type} ${item.title} ${item.category}`,
      run: () => {
        const node = createNodeInstance(item.type, registry, graphCenter);
        addNode(node);
      },
    }));
    return [
      ...addActions,
      {
        id: "duplicate-selection",
        title: "复制选中节点",
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
        title: "自动布局",
        run: () => {
          void autoLayoutGraph(graphRef.current, registry).then((commands) => applyCommands(commands));
        },
      },
      {
        id: "focus-error",
        title: "定位下一个错误",
        run: () => focusNextError(),
      },
      {
        id: "run-graph",
        title: "运行图",
        run: () =>
          runtimeSend({
            type: "RUN_WITH_INPUTS",
            inputs: graphInputs,
            presetId: selectedPresetId ?? undefined,
            seed: seedRef.current++,
          }),
      },
      {
        id: "step-graph",
        title: "单步执行",
        run: () =>
          runtimeSend({
            type: "STEP_WITH_INPUTS",
            inputs: graphInputs,
            presetId: selectedPresetId ?? undefined,
            seed: seedRef.current++,
          }),
      },
      {
        id: "open-json",
        title: "打开 JSON 视图",
        run: () => setTab("json"),
      },
      {
        id: "open-graph",
        title: "打开外化视图",
        run: () => setTab("graph"),
      },
    ];
  }, [
    graphCenter,
    runtimeSend,
    graphInputs,
    selectedPresetId,
    setTab,
    registry,
    errorIndex,
    addNode,
    applyCommands,
    focusNextError,
  ]);

  const handleUndo = () => {
    const result = undoHistory(historyRef.current, graphRef.current);
    if (!result.graph) return;
    historyRef.current = result.state;
    historyActionRef.current = "undo";
    pendingSnapshotRef.current = true;
    applyGraphReplace(result.graph);
  };

  const handleRedo = () => {
    const result = redoHistory(historyRef.current, graphRef.current);
    if (!result.graph) return;
    historyRef.current = result.state;
    historyActionRef.current = "redo";
    pendingSnapshotRef.current = true;
    applyGraphReplace(result.graph);
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
      // ... (Kept as original)
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }} data-testid="studio-root">
      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        actions={paletteActions}
        onQueryChange={setPaletteQuery}
        onClose={() => setPaletteOpen(false)}
      />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            图工作室
            <Typography variant="caption" sx={{ ml: 2, color: "text.secondary" }}>
              蓝图语义 + 元数据表单
            </Typography>
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            {statusBlock}
            <IconButton onClick={handleUndo} disabled={!canUndo(historyRef.current)} title="撤销">
              <UndoIcon />
            </IconButton>
            <IconButton onClick={handleRedo} disabled={!canRedo(historyRef.current)} title="重做">
              <RedoIcon />
            </IconButton>
            <IconButton onClick={handleOpenCanvasWindow} title="打开新窗口">
              <OpenInNewIcon />
            </IconButton>
            <IconButton onClick={() => runtimeSend({ type: "RESET" })} title="重置">
              <RefreshIcon />
            </IconButton>
            <IconButton
              onClick={() => {
                runtimeSend({
                  type: "STEP_WITH_INPUTS",
                  inputs: graphInputs,
                  presetId: selectedPresetId ?? undefined,
                  seed: seedRef.current++,
                });
              }}
              title="单步"
            >
              <SkipNextIcon />
            </IconButton>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={() => {
                runtimeSend({
                  type: "RUN_WITH_INPUTS",
                  inputs: graphInputs,
                  presetId: selectedPresetId ?? undefined,
                  seed: seedRef.current++,
                });
              }}
            >
              运行
            </Button>
            <Chip
              label={snapshot.status}
              color={snapshot.status === "running" ? "primary" : "default"}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="standard"
          indicatorColor="primary"
          textColor="primary"
          sx={{ minHeight: 48, px: 2 }}
        >
          <Tab label="工作区" value="studio" />
          <Tab label="JSON" value="json" />
          <Tab label="外化" value="graph" />
        </Tabs>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: "hidden", display: "flex", position: "relative" }}>
        {tab === "studio" && (
          <>
            <Drawer
              variant="permanent"
              sx={{
                width: DRAWER_WIDTH,
                flexShrink: 0,
                "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", position: "absolute", top: 0, height: "100%" },
              }}
              PaperProps={{ style: { position: "absolute" } }} // Important for layout within Flex container
            >
              <Palette graph={graph} registry={registry} center={graphCenter} onAddNode={addNode} />
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", height: "100%" }}>
              <Box sx={{ flexGrow: 1, position: "relative" }}>
                <GraphViewer
                  graph={graph}
                  registry={registry}
                  selectedNodeId={state.context.selectedNodeId}
                  selectedNodeIds={selectedNodeIds}
                  focusedPin={state.context.focusedPin}
                  validationErrors={state.context.validationErrors}
                  runningNodeId={ecs.runningNodeId}
                  breakpoints={ecs.breakpoints}
                  suppressDrag={isRemoteSyncing}
                  snapToGrid={snapToGrid}
                  onToggleSnap={() => setSnapToGrid((prev) => !prev)}
                  onAlign={(mode) => applyCommands(alignNodes(graphRef.current, selectedNodeIds, mode))}
                  onDistribute={(mode) =>
                    applyCommands(distributeNodes(graphRef.current, selectedNodeIds, mode))
                  }
                  onAutoLayout={() => {
                    void autoLayoutGraph(graphRef.current, registry).then((commands) => applyCommands(commands));
                  }}
                  onSelectNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
                  onSelectNodes={(nodeIds) => {
                    setSelectedNodeIds(nodeIds);
                    send({ type: "SELECT_NODE", nodeId: nodeIds[0] ?? null });
                  }}
                  onCommand={handleCommand}
                />
              </Box>
              
              <Box sx={{ height: 200, borderTop: 1, borderColor: "divider", overflow: "auto" }}>
                 <Stack direction="row" spacing={2} sx={{ height: "100%" }}>
                    <Box sx={{ width: "50%", p: 1, borderRight: 1, borderColor: "divider" }}>
                       <Runner
                        viewModel={snapshot.viewModel}
                        status={snapshot.status}
                        outputs={snapshot.outputs}
                        presets={presets.map((preset) => ({ id: preset.id, title: preset.title }))}
                        selectedPresetId={selectedPresetId}
                        onSelectPreset={(presetId) => setSelectedPresetId(presetId)}
                        onNext={() => runtimeSend({ type: "NEXT" })}
                        onChoose={(choiceKey) => runtimeSend({ type: "CHOOSE", choiceKey })}
                      />
                    </Box>
                    <Box sx={{ width: "50%", p: 1 }}>
                        <LintPanel
                          issues={lintIssues}
                          onFix={(issue) => {
                            if (!issue.fix) return;
                            applyCommands(issue.fix.commands);
                          }}
                          onFocusNode={(nodeId) => send({ type: "SELECT_NODE", nodeId })}
                        />
                    </Box>
                 </Stack>
              </Box>
            </Box>

            <Drawer
              variant="permanent"
              anchor="right"
              sx={{
                width: RIGHT_DRAWER_WIDTH,
                flexShrink: 0,
                "& .MuiDrawer-paper": { width: RIGHT_DRAWER_WIDTH, boxSizing: "border-box", position: "absolute", top: 0, height: "100%" },
              }}
              PaperProps={{ style: { position: "absolute" } }}
            >
              <Box sx={{ height: "50%", overflow: "auto", borderBottom: 1, borderColor: "divider" }}>
                 <Inspector
                    graph={graph}
                    nodeId={state.context.selectedNodeId}
                    registry={registry}
                    lastNodeIO={ecs.lastNodeIO}
                    validationErrors={state.context.validationErrors}
                    onApplyProps={applyProps}
                    onDeleteNode={deleteNode}
                    hasBreakpoint={
                      state.context.selectedNodeId
                        ? ecs.breakpoints.includes(state.context.selectedNodeId)
                        : false
                    }
                    onToggleBreakpoint={(nodeId) => runtimeSend({ type: "TOGGLE_BREAKPOINT", nodeId })}
                  />
              </Box>
              <Box sx={{ height: "50%", overflow: "auto", display: "flex", flexDirection: "column" }}>
                <Tabs
                  value={rightTab}
                  onChange={(_, value) => setRightTab(value)}
                  variant="fullWidth"
                >
                  <Tab label="执行轨迹" value="trace" />
                  <Tab label="变量" value="vars" />
                </Tabs>
                <Box sx={{ flexGrow: 1, overflow: "auto" }}>
                  {rightTab === "trace" ? (
                    <TracePanel trace={ecs.trace} runMeta={snapshot.runMeta} />
                  ) : (
                    <VariablesPanel vars={snapshot.vars} />
                  )}
                </Box>
              </Box>
            </Drawer>
          </>
        )}

        {tab === "json" && (
          <Box sx={{ p: 2, height: "100%", width: "100%", overflow: "auto" }}>
            <JsonTab
              draft={state.context.jsonDraft}
              error={state.context.jsonError}
              onChange={(draft) => send({ type: "JSON_EDIT", draft })}
              onApply={() => {
                pendingSnapshotRef.current = true;
                pendingHistoryRef.current = true;
                pendingApplyJsonRef.current = true;
                send({ type: "APPLY_JSON" });
              }}
              onReset={() => send({ type: "SYNC_JSON", draft: stringifyGraph(graph) })}
            />
          </Box>
        )}

        {tab === "graph" && (
           <Box sx={{ p: 2, height: "100%", width: "100%", overflow: "auto" }}>
            <GraphSettings
              contract={contract}
              inputValues={graphInputs}
              onChangeInputs={(next) => setGraphInputs(next)}
              onApplyContract={applyContract}
              presets={presets}
              onApplyPresets={applyPresets}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

const CanvasOnlyApp = () => {
   // ... (Similar update or leave simple)
   // Keeping it simple for now, but wrapped in ThemeProvider
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
