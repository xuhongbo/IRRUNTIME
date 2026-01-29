// 文件说明：自动补充文件级注释，描述模块职责与用途

// Rete 节点视图：控制端口与控制器渲染顺序
import React from "react";
import { Presets } from "rete-react-plugin";
import type { ClassicPreset } from "rete";
import type { ReteNodeData } from "./types";

// 根据 index 排序端口或控件
const sortByIndex = <T extends { index?: number }>(entries: [string, T | undefined][]) => {
  entries.sort((a, b) => (a[1]?.index ?? 0) - (b[1]?.index ?? 0));
};

// 节点视图参数
type NodeViewProps = {
  data: ClassicPreset.Node & ReteNodeData;
  emit: (props: Presets.classic.ReactArea2D<Presets.classic.ClassicScheme>) => void;
};

// 节点渲染：包含标题、端口与控件
export const NodeView = ({ data, emit }: NodeViewProps) => {
  const inputs = Object.entries(data.inputs);
  const outputs = Object.entries(data.outputs);
  const controls = Object.entries(data.controls);
  sortByIndex(inputs);
  sortByIndex(outputs);
  sortByIndex(controls);

  const isSelected = Boolean(data.selected);
  const metaInputs = new Map(data.inputsMeta.map((pin) => [pin.key, pin]));
  const metaOutputs = new Map(data.outputsMeta.map((pin) => [pin.key, pin]));
  const nodeHasError = data.nodeErrors.length > 0;
  const pinErrors = data.pinErrors ?? {};
  const focusedPinKey = data.focusedPinKey;
  const isRunning = data.isRunning;
  const hasBreakpoint = data.hasBreakpoint;

  return (
    <Presets.classic.NodeStyles
      selected={isSelected}
      data-testid={`node-${data.id}`}
      className={`rete-node ${nodeHasError ? "error" : ""} ${isRunning ? "running" : ""}`}
    >
      <div className="rete-title" data-testid={`node-title-${data.id}`}>
        {data.label}
        {nodeHasError && <span className="rete-node-error-badge">!</span>}
        {isRunning && <span className="rete-node-running-badge">●</span>}
        {hasBreakpoint && <span className="rete-node-breakpoint-badge">⏸</span>}
      </div>
      {outputs.map(([key, output]) => {
        if (!output) return null;
        const meta = metaOutputs.get(key);
        const hasError = (pinErrors[key] ?? []).length > 0;
        const isFocused = focusedPinKey === key;
        return (
          <div
            key={key}
            className={`rete-port rete-output ${meta?.kind ?? "data"} ${hasError ? "error" : ""} ${
              isFocused ? "focused" : ""
            }`}
            data-testid={`pin-${data.id}-${key}`}
          >
            <div className="rete-port-label">{output.label}</div>
            <Presets.classic.RefSocket
              name="output-socket"
              side="output"
              socketKey={key}
              nodeId={data.id}
              emit={emit}
              payload={output.socket}
            />
          </div>
        );
      })}
      {controls.map(([key, control]) =>
        control ? (
          <Presets.classic.RefControl key={key} name="control" emit={emit} payload={control} />
        ) : null
      )}
      {inputs.map(([key, input]) => {
        if (!input) return null;
        const meta = metaInputs.get(key);
        const hasError = (pinErrors[key] ?? []).length > 0;
        const isFocused = focusedPinKey === key;
        return (
          <div
            key={key}
            className={`rete-port rete-input ${meta?.kind ?? "data"} ${hasError ? "error" : ""} ${
              isFocused ? "focused" : ""
            }`}
            data-testid={`pin-${data.id}-${key}`}
          >
            <Presets.classic.RefSocket
              name="input-socket"
              side="input"
              socketKey={key}
              nodeId={data.id}
              emit={emit}
              payload={input.socket}
            />
            <div className="rete-port-label">{input.label}</div>
          </div>
        );
      })}
    </Presets.classic.NodeStyles>
  );
};
