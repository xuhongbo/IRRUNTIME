import React, { useEffect, useMemo, useState } from "react";
import type { Graph, NodeIO } from "../engine/ir";
import type { FormFieldDef, Registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import { getNodePinStatus, groupNodeErrors } from "./inspectorUtils";
import { normalizeContract } from "../engine/contract";
import "./Inspector.css";

type InspectorProps = {
  graph: Graph;
  nodeId: string | null;
  registry: Registry;
  lastNodeIO: Record<string, NodeIO>;
  validationErrors: ValidationError[];
  onApplyProps: (nodeId: string, props: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  hasBreakpoint: boolean;
  onToggleBreakpoint: (nodeId: string) => void;
};

export const Inspector = ({
  graph,
  nodeId,
  registry,
  lastNodeIO,
  validationErrors,
  onApplyProps,
  onDeleteNode,
  hasBreakpoint,
  onToggleBreakpoint,
}: InspectorProps) => {
  const node = useMemo(() => graph.nodes.find((n) => n.id === nodeId) ?? null, [graph, nodeId]);
  const def = node ? registry.get(node.type, node.version) ?? registry.getLatest(node.type) : null;
  const [draftProps, setDraftProps] = useState<Record<string, unknown>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (node) {
      setDraftProps({ ...node.props });
      setJsonErrors({});
    }
  }, [node]);

  if (!node || !def) {
    return (
      <div className="inspector" data-testid="inspector-root">
        <div className="inspector-header">
          <div>
            <div className="inspector-title">检查器</div>
            <div className="inspector-subtitle">请选择一个节点</div>
          </div>
        </div>
      </div>
    );
  }

  const resolvedForm = useMemo<FormFieldDef[]>(() => {
    if (!node) return def?.form ?? [];
    if (!def) return [];
    if (node.type !== "GraphInput" && node.type !== "GraphOutput") {
      return def.form;
    }
    const contract = normalizeContract(graph.contract);
    const typeLabels: Record<string, string> = {
      string: "字符串",
      number: "数字",
      boolean: "布尔",
      json: "JSON",
    };
    const options =
      node.type === "GraphInput"
        ? contract.inputs.map((item) => ({
            value: item.name,
            label: `${item.name}（${typeLabels[item.type] ?? item.type}）`,
          }))
        : contract.outputs.map((item) => ({
            value: item.name,
            label: `${item.name}（${typeLabels[item.type] ?? item.type}）`,
          }));
    return def.form.map((field) =>
      field.key === "name" ? { ...field, options } : field
    );
  }, [def, graph.contract, node]);

  const apply = () => {
    const errors: Record<string, string> = {};
    const nextProps: Record<string, unknown> = { ...draftProps };
    for (const field of resolvedForm) {
      if (field.type === "json" || field.type === "array") {
        const raw = draftProps[field.key];
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            nextProps[field.key] = parsed;
          } catch (err) {
            errors[field.key] = "JSON 无效";
          }
        }
      }
    }
    setJsonErrors(errors);
    if (Object.keys(errors).length === 0) {
      onApplyProps(node.id, nextProps);
    }
  };

  const io = lastNodeIO[node.id];
  const errorGroups = groupNodeErrors(validationErrors, node.id);
  const pinStatus = getNodePinStatus(graph, node.id, registry, errorGroups.pinErrors);

  return (
    <div className="inspector" data-testid="inspector-root">
      <div className="inspector-header">
        <div>
          <div className="inspector-title">检查器</div>
          <div className="inspector-subtitle">
            {node.type}@{node.version}
          </div>
          <div className="inspector-node-id" data-testid="inspector-node-id">
            {node.id}
          </div>
        </div>
        <div className="inspector-actions">
          <button
            className={`button ${hasBreakpoint ? "primary" : ""}`}
            onClick={() => onToggleBreakpoint(node.id)}
            data-testid="toggle-breakpoint"
          >
            {hasBreakpoint ? "断点已开" : "添加断点"}
          </button>
          <button className="button danger" onClick={() => onDeleteNode(node.id)} data-testid="delete-node">
            删除
          </button>
        </div>
      </div>
      <div className="inspector-section">
        <div className="inspector-section-title">属性</div>
        {resolvedForm.length === 0 && <div className="inspector-empty">暂无可编辑属性。</div>}
        {resolvedForm.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            value={draftProps[field.key]}
            error={jsonErrors[field.key]}
            onChange={(value) => {
              setDraftProps((prev) => ({ ...prev, [field.key]: value }));
            }}
          />
        ))}
        <button className="button primary" onClick={apply} data-testid="inspector-apply">
          应用
        </button>
        <div className="props-preview" data-testid="props-preview">
          <div className="props-preview-title">当前属性</div>
          <pre>{JSON.stringify(node.props, null, 2)}</pre>
        </div>
      </div>
      <div className="inspector-section">
        <div className="inspector-section-title">引脚</div>
        {!pinStatus && <div className="inspector-empty">暂无引脚信息。</div>}
        {pinStatus && (
          <div className="pin-grid">
            <div className="pin-group">
              <div className="pin-group-title">输入</div>
              {pinStatus.inputs.length === 0 && <div className="inspector-empty">暂无输入。</div>}
              {pinStatus.inputs.map((pin) => (
                <div
                  key={`in-${pin.key}`}
                  className={`pin-row ${pin.connected ? "connected" : "disconnected"} ${
                    pin.errors.length > 0 ? "error" : ""
                  }`}
                >
                  <div className="pin-main">
                    <span className={`pin-kind ${pin.kind}`}>{pin.kind === "exec" ? "执行" : "数据"}</span>
                    <span className="pin-label">{pin.label}</span>
                    {pin.dataType && <span className="pin-type">{pin.dataType}</span>}
                  </div>
                  <div className="pin-meta">
                    {pin.connected ? `${pin.connections} 条连接` : pin.required ? "必填" : "可选"}
                  </div>
                  {pin.errors.length > 0 && (
                    <div className="pin-errors">
                      {pin.errors.map((msg, index) => (
                        <div key={`${pin.key}-err-${index}`}>{msg}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="pin-group">
              <div className="pin-group-title">输出</div>
              {pinStatus.outputs.length === 0 && <div className="inspector-empty">暂无输出。</div>}
              {pinStatus.outputs.map((pin) => (
                <div
                  key={`out-${pin.key}`}
                  className={`pin-row ${pin.connected ? "connected" : "disconnected"} ${
                    pin.errors.length > 0 ? "error" : ""
                  }`}
                >
                  <div className="pin-main">
                    <span className={`pin-kind ${pin.kind}`}>{pin.kind === "exec" ? "执行" : "数据"}</span>
                    <span className="pin-label">{pin.label}</span>
                    {pin.dataType && <span className="pin-type">{pin.dataType}</span>}
                  </div>
                  <div className="pin-meta">
                    {pin.connected ? `${pin.connections} 条连接` : pin.required ? "必填" : "可选"}
                  </div>
                  {pin.errors.length > 0 && (
                    <div className="pin-errors">
                      {pin.errors.map((msg, index) => (
                        <div key={`${pin.key}-err-${index}`}>{msg}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {errorGroups.nodeErrors.length > 0 && (
        <div className="inspector-section">
          <div className="inspector-section-title">节点错误</div>
          <div className="pin-errors">
            {errorGroups.nodeErrors.map((err, index) => (
              <div key={`${node.id}-node-err-${index}`}>{err.message}</div>
            ))}
          </div>
        </div>
      )}
      <div className="inspector-section">
        <div className="inspector-section-title">节点输入输出</div>
        {!io && <div className="inspector-empty">暂无运行记录。</div>}
        {io && (
          <div className="io-grid">
            <div className="io-block">
              <div className="io-title">输入</div>
              <pre>{JSON.stringify(io.inputs, null, 2)}</pre>
            </div>
            <div className="io-block">
              <div className="io-title">输出</div>
              <pre>{JSON.stringify(io.outputs, null, 2)}</pre>
            </div>
            {io.logs && io.logs.length > 0 && (
              <div className="io-block">
                <div className="io-title">日志</div>
                <pre>{io.logs.join("\n")}</pre>
              </div>
            )}
            <div className="io-meta">
              <span>耗时：{io.durationMs.toFixed(2)} ms</span>
              {io.error && <span className="io-error">错误：{io.error}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type FieldEditorProps = {
  field: FormFieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
};

const FieldEditor = ({ field, value, error, onChange }: FieldEditorProps) => {
  const id = `field-${field.key}`;
  const common = {
    id,
    name: field.key,
    "data-testid": id,
  };

  const renderInput = () => {
    switch (field.type) {
      case "string":
        return (
          <input
            {...common}
            type="text"
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      case "number":
        return (
          <input
            {...common}
            type="number"
            value={typeof value === "number" ? value : 0}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        );
      case "boolean":
        return (
          <label className="switch">
            <input
              {...common}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span className="slider" />
          </label>
        );
      case "select":
        return (
          <select {...common} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case "textarea":
        return (
          <textarea
            {...common}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      case "json":
      case "array": {
        const textValue = typeof value === "string" ? value : JSON.stringify(value ?? (field.type === "array" ? [] : {}), null, 2);
        return (
          <textarea
            {...common}
            className="json"
            value={textValue}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="field">
      <label htmlFor={id}>{field.label}</label>
      {renderInput()}
      {field.helpText && <div className="field-help">{field.helpText}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
};
