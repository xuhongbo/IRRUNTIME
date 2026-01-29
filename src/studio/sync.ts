// 文件说明：自动补充文件级注释，描述模块职责与用途

// 跨标签页同步：通过 BroadcastChannel 共享图与命令
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Graph } from "../engine/ir";
import type { Command } from "./commands";

// 同步消息类型：请求快照、发送快照或命令
export type SyncMessage =
  | { type: "snapshot-request"; sourceId: string; seq: number; ts: number }
  | { type: "snapshot"; sourceId: string; seq: number; ts: number; graph: Graph }
  | { type: "command"; sourceId: string; seq: number; ts: number; command: Command }
  | { type: "command-batch"; sourceId: string; seq: number; ts: number; commands: Command[] }
  | { type: "breakpoints"; sourceId: string; seq: number; ts: number; breakpoints: string[] };

// 同步模式：主编辑器或画布视图
export type SyncMode = "main" | "canvas";

// 生成当前标签页标识
export const createSourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `source-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

// 判断消息是否应该被当前页面接受（去重与过滤自身）
export const acceptMessage = (
  selfId: string,
  lastSeqBySource: Map<string, number>,
  message: SyncMessage
) => {
  if (message.sourceId === selfId) return false;
  const lastSeq = lastSeqBySource.get(message.sourceId) ?? -1;
  if (message.seq <= lastSeq) return false;
  lastSeqBySource.set(message.sourceId, message.seq);
  return true;
};

// 同步 Hook 配置
type GraphSyncOptions = {
  graph: Graph;
  mode: SyncMode;
  onApplyGraph: (graph: Graph) => void;
  onApplyCommand: (command: Command) => void;
  onApplyCommands?: (commands: Command[]) => void;
  onApplyBreakpoints?: (breakpoints: string[]) => void;
  channelName?: string;
  enabled?: boolean;
};

// 图同步 Hook：封装发送与接收逻辑
export const useGraphSync = ({
  graph,
  mode,
  onApplyGraph,
  onApplyCommand,
  onApplyCommands,
  onApplyBreakpoints,
  channelName = "graph-studio-sync",
  enabled = true,
}: GraphSyncOptions) => {
  const sourceId = useMemo(() => createSourceId(), []);
  const seqRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const graphRef = useRef(graph);
  const lastSeqBySource = useRef<Map<string, number>>(new Map());
  const localDirtyAtRef = useRef(0);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  const sendMessage = useCallback(
    (message: SyncMessage) => {
      if (!enabled) return;
      channelRef.current?.postMessage(message);
    },
    [enabled]
  );

  const sendCommand = useCallback(
    (command: Command) => {
      sendMessage({ type: "command", sourceId, seq: nextSeq(), ts: Date.now(), command });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const sendSnapshot = useCallback(
    (snapshot: Graph) => {
      sendMessage({ type: "snapshot", sourceId, seq: nextSeq(), ts: Date.now(), graph: snapshot });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const sendCommands = useCallback(
    (commands: Command[]) => {
      sendMessage({ type: "command-batch", sourceId, seq: nextSeq(), ts: Date.now(), commands });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const sendBreakpoints = useCallback(
    (breakpoints: string[]) => {
      sendMessage({ type: "breakpoints", sourceId, seq: nextSeq(), ts: Date.now(), breakpoints });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const requestSnapshot = useCallback(() => {
    sendMessage({ type: "snapshot-request", sourceId, seq: nextSeq(), ts: Date.now() });
  }, [nextSeq, sendMessage, sourceId]);

  const markLocalChange = useCallback(() => {
    localDirtyAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const handler = (event: MessageEvent<SyncMessage>) => {
      const message = event.data;
      if (!message || typeof message.type !== "string") return;
      if (!acceptMessage(sourceId, lastSeqBySource.current, message)) return;
      if (message.type === "snapshot-request") {
        if (mode === "main") {
          sendSnapshot(graphRef.current);
        }
        return;
      }
      if (message.type === "snapshot") {
        if (localDirtyAtRef.current && message.ts < localDirtyAtRef.current) {
          return;
        }
        localDirtyAtRef.current = 0;
        onApplyGraph(message.graph);
        return;
      }
      if (message.type === "command") {
        localDirtyAtRef.current = 0;
        onApplyCommand(message.command);
        return;
      }
      if (message.type === "command-batch") {
        localDirtyAtRef.current = 0;
        onApplyCommands?.(message.commands);
        return;
      }
      if (message.type === "breakpoints") {
        onApplyBreakpoints?.(message.breakpoints);
      }
    };

    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, [channelName, enabled, mode, onApplyCommand, onApplyGraph, sendSnapshot, sourceId]);

  return useMemo(
    () => ({
      sourceId,
      sendCommand,
      sendCommands,
      sendSnapshot,
      requestSnapshot,
      markLocalChange,
      sendBreakpoints,
    }),
    [markLocalChange, requestSnapshot, sendBreakpoints, sendCommand, sendCommands, sendSnapshot, sourceId]
  );
};
