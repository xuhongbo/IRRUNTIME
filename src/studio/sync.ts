import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Graph } from "../engine/ir";
import type { Command } from "./commands";

export type SyncMessage =
  | { type: "snapshot-request"; sourceId: string; seq: number }
  | { type: "snapshot"; sourceId: string; seq: number; graph: Graph }
  | { type: "command"; sourceId: string; seq: number; command: Command };

export type SyncMode = "main" | "canvas";

export const createSourceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `source-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

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

type GraphSyncOptions = {
  graph: Graph;
  mode: SyncMode;
  onApplyGraph: (graph: Graph) => void;
  onApplyCommand: (command: Command) => void;
  channelName?: string;
  enabled?: boolean;
};

export const useGraphSync = ({
  graph,
  mode,
  onApplyGraph,
  onApplyCommand,
  channelName = "graph-studio-sync",
  enabled = true,
}: GraphSyncOptions) => {
  const sourceId = useMemo(() => createSourceId(), []);
  const seqRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const graphRef = useRef(graph);
  const lastSeqBySource = useRef<Map<string, number>>(new Map());

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
      sendMessage({ type: "command", sourceId, seq: nextSeq(), command });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const sendSnapshot = useCallback(
    (snapshot: Graph) => {
      sendMessage({ type: "snapshot", sourceId, seq: nextSeq(), graph: snapshot });
    },
    [nextSeq, sendMessage, sourceId]
  );

  const requestSnapshot = useCallback(() => {
    sendMessage({ type: "snapshot-request", sourceId, seq: nextSeq() });
  }, [nextSeq, sendMessage, sourceId]);

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
        onApplyGraph(message.graph);
        return;
      }
      if (message.type === "command") {
        onApplyCommand(message.command);
      }
    };

    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, [channelName, enabled, mode, onApplyCommand, onApplyGraph, sendSnapshot, sourceId]);

  return {
    sourceId,
    sendCommand,
    sendSnapshot,
    requestSnapshot,
  };
};
