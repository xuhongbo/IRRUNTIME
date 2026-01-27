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
            <div className="inspector-title">Inspector</div>
            <div className="inspector-subtitle">Select a node</div>
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
    const options =
      node.type === "GraphInput"
        ? contract.inputs.map((item) => ({ value: item.name, label: `${item.name} (${item.type})` }))
        : contract.outputs.map((item) => ({ value: item.name, label: `${item.name} (${item.type})` }));
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
            errors[field.key] = "Invalid JSON";
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
          <div className="inspector-title">Inspector</div>
          <div className="inspector-subtitle">
            {node.type}@{node.version}
          </div>
          <div className="inspector-node-id" data-testid="inspector-node-id">
            {node.id}
          </div>
        </div>
        <div className="inspector-actions">
          <button className={`button ${hasBreakpoint ? "primary" : ""}`} onClick={() => onToggleBreakpoint(node.id)}>
            {hasBreakpoint ? "Breakpoint On" : "Add Breakpoint"}
          </button>
          <button className="button danger" onClick={() => onDeleteNode(node.id)}>
            Delete
          </button>
        </div>
      </div>
      <div className="inspector-section">
        <div className="inspector-section-title">Properties</div>
        {resolvedForm.length === 0 && <div className="inspector-empty">No editable props.</div>}
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
        <button className="button primary" onClick={apply}>
          Apply
        </button>
        <div className="props-preview" data-testid="props-preview">
          <div className="props-preview-title">Current Props</div>
          <pre>{JSON.stringify(node.props, null, 2)}</pre>
        </div>
      </div>
      <div className="inspector-section">
        <div className="inspector-section-title">Pins</div>
        {!pinStatus && <div className="inspector-empty">No pin metadata.</div>}
        {pinStatus && (
          <div className="pin-grid">
            <div className="pin-group">
              <div className="pin-group-title">Inputs</div>
              {pinStatus.inputs.length === 0 && <div className="inspector-empty">No inputs.</div>}
              {pinStatus.inputs.map((pin) => (
                <div
                  key={`in-${pin.key}`}
                  className={`pin-row ${pin.connected ? "connected" : "disconnected"} ${
                    pin.errors.length > 0 ? "error" : ""
                  }`}
                >
                  <div className="pin-main">
                    <span className={`pin-kind ${pin.kind}`}>{pin.kind}</span>
                    <span className="pin-label">{pin.label}</span>
                    {pin.dataType && <span className="pin-type">{pin.dataType}</span>}
                  </div>
                  <div className="pin-meta">
                    {pin.connected ? `${pin.connections} conn` : pin.required ? "required" : "optional"}
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
              <div className="pin-group-title">Outputs</div>
              {pinStatus.outputs.length === 0 && <div className="inspector-empty">No outputs.</div>}
              {pinStatus.outputs.map((pin) => (
                <div
                  key={`out-${pin.key}`}
                  className={`pin-row ${pin.connected ? "connected" : "disconnected"} ${
                    pin.errors.length > 0 ? "error" : ""
                  }`}
                >
                  <div className="pin-main">
                    <span className={`pin-kind ${pin.kind}`}>{pin.kind}</span>
                    <span className="pin-label">{pin.label}</span>
                    {pin.dataType && <span className="pin-type">{pin.dataType}</span>}
                  </div>
                  <div className="pin-meta">
                    {pin.connected ? `${pin.connections} conn` : pin.required ? "required" : "optional"}
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
          <div className="inspector-section-title">Node Errors</div>
          <div className="pin-errors">
            {errorGroups.nodeErrors.map((err, index) => (
              <div key={`${node.id}-node-err-${index}`}>{err.message}</div>
            ))}
          </div>
        </div>
      )}
      <div className="inspector-section">
        <div className="inspector-section-title">Node IO</div>
        {!io && <div className="inspector-empty">No execution recorded yet.</div>}
        {io && (
          <div className="io-grid">
            <div className="io-block">
              <div className="io-title">Inputs</div>
              <pre>{JSON.stringify(io.inputs, null, 2)}</pre>
            </div>
            <div className="io-block">
              <div className="io-title">Outputs</div>
              <pre>{JSON.stringify(io.outputs, null, 2)}</pre>
            </div>
            {io.logs && io.logs.length > 0 && (
              <div className="io-block">
                <div className="io-title">Logs</div>
                <pre>{io.logs.join("\n")}</pre>
              </div>
            )}
            <div className="io-meta">
              <span>Duration: {io.durationMs.toFixed(2)} ms</span>
              {io.error && <span className="io-error">Error: {io.error}</span>}
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
