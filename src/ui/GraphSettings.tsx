import React, { useEffect, useMemo, useState } from "react";
import type { GraphContract, GraphContractPort } from "../engine/ir";
import "./GraphSettings.css";

type GraphSettingsProps = {
  contract: GraphContract;
  inputValues: Record<string, unknown>;
  onChangeInputs: (next: Record<string, unknown>) => void;
  onApplyContract: (contract: GraphContract) => void;
  presets: { id: string; title: string; description?: string; inputs: Record<string, unknown> }[];
  onApplyPresets: (presets: GraphSettingsProps["presets"]) => void;
};

const dataTypes: GraphContractPort["type"][] = ["string", "number", "boolean", "json"];

export const GraphSettings = ({
  contract,
  inputValues,
  onChangeInputs,
  onApplyContract,
  presets,
  onApplyPresets,
}: GraphSettingsProps) => {
  const [draft, setDraft] = useState<GraphContract>(contract);
  const [inputDraft, setInputDraft] = useState<Record<string, string>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [presetDraft, setPresetDraft] = useState<
    { id: string; title: string; description?: string; inputs: string }[]
  >([]);

  useEffect(() => {
    setDraft(contract);
  }, [contract]);

  useEffect(() => {
    setPresetDraft(
      presets.map((preset) => ({
        id: preset.id,
        title: preset.title,
        description: preset.description,
        inputs: JSON.stringify(preset.inputs ?? {}, null, 2),
      }))
    );
  }, [presets]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const input of contract.inputs) {
      const value = inputValues[input.name];
      if (input.type === "json") {
        next[input.name] = JSON.stringify(value ?? null, null, 2);
      } else {
        next[input.name] = value === undefined ? "" : String(value);
      }
    }
    setInputDraft(next);
  }, [contract.inputs, inputValues]);

  const normalized = useMemo(() => ({
    inputs: draft.inputs.filter((item) => item.name.trim().length > 0),
    outputs: draft.outputs.filter((item) => item.name.trim().length > 0),
  }), [draft.inputs, draft.outputs]);

  const updateContractItem = (
    kind: "inputs" | "outputs",
    index: number,
    next: Partial<GraphContractPort>
  ) => {
    setDraft((prev) => {
      const list = [...prev[kind]];
      list[index] = { ...list[index], ...next };
      return { ...prev, [kind]: list };
    });
  };

  const addContractItem = (kind: "inputs" | "outputs") => {
    setDraft((prev) => ({
      ...prev,
      [kind]: [...prev[kind], { name: "", type: "string", required: kind === "outputs" }],
    }));
  };

  const removeContractItem = (kind: "inputs" | "outputs", index: number) => {
    setDraft((prev) => {
      const list = [...prev[kind]];
      list.splice(index, 1);
      return { ...prev, [kind]: list };
    });
  };

  const parseInputValue = (type: GraphContractPort["type"], raw: string): { ok: boolean; value: unknown } => {
    if (type === "number") {
      const value = Number(raw);
      return { ok: !Number.isNaN(value), value };
    }
    if (type === "boolean") {
      return { ok: true, value: raw === "true" };
    }
    if (type === "json") {
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch (err) {
        return { ok: false, value: null };
      }
    }
    return { ok: true, value: raw };
  };

  const parseJsonValue = (raw: string): { ok: boolean; value: unknown } => {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return { ok: false, value: null };
    }
  };

  const applyInputs = () => {
    const next: Record<string, unknown> = { ...inputValues };
    const errors: Record<string, string> = {};
    for (const input of contract.inputs) {
      const raw = inputDraft[input.name] ?? "";
      const result = parseInputValue(input.type, raw);
      if (!result.ok) {
        errors[input.name] = "JSON parse error";
        continue;
      }
      next[input.name] = result.value;
    }
    setInputErrors(errors);
    if (Object.keys(errors).length === 0) {
      onChangeInputs(next);
    }
  };

  const applyContract = () => {
    const errors: Record<string, string> = {};
    const convert = (item: GraphContractPort) => {
      const next: GraphContractPort = { ...item };
      if (next.type === "json" && typeof next.defaultValue === "string") {
        const result = parseJsonValue(next.defaultValue);
        if (!result.ok) {
          errors[`${next.name}-default`] = "Default JSON invalid";
        } else {
          next.defaultValue = result.value;
        }
      } else if (next.type === "number" && typeof next.defaultValue === "string") {
        const value = Number(next.defaultValue);
        if (Number.isNaN(value)) {
          errors[`${next.name}-default`] = "Default number invalid";
        } else {
          next.defaultValue = value;
        }
      } else if (next.type === "boolean" && typeof next.defaultValue === "string") {
        next.defaultValue = next.defaultValue === "true";
      }
      if (typeof next.examples === "string") {
        const result = parseJsonValue(next.examples);
        if (!result.ok || !Array.isArray(result.value)) {
          errors[`${next.name}-examples`] = "Examples must be JSON array";
        } else {
          next.examples = result.value;
        }
      }
      return next;
    };
    const inputs = draft.inputs.filter((item) => item.name.trim().length > 0).map(convert);
    const outputs = draft.outputs.filter((item) => item.name.trim().length > 0).map(convert);
    setInputErrors(errors);
    if (Object.keys(errors).length === 0) {
      onApplyContract({ inputs, outputs });
    }
  };

  const addPreset = () => {
    setPresetDraft((prev) => [
      ...prev,
      { id: `preset-${Date.now()}`, title: "New Preset", description: "", inputs: "{}" },
    ]);
  };

  const updatePreset = (index: number, next: Partial<(typeof presetDraft)[number]>) => {
    setPresetDraft((prev) => {
      const list = [...prev];
      list[index] = { ...list[index], ...next };
      return list;
    });
  };

  const removePreset = (index: number) => {
    setPresetDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  const applyPresets = () => {
    const errors: Record<string, string> = {};
    const mapped = presetDraft.map((preset) => {
      const parsed = parseJsonValue(preset.inputs);
      if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
        errors[preset.id] = "Preset inputs must be JSON object";
      }
      return {
        id: preset.id,
        title: preset.title,
        description: preset.description,
        inputs: parsed.ok && typeof parsed.value === "object" && parsed.value !== null ? parsed.value : {},
      };
    });
    setInputErrors(errors);
    if (Object.keys(errors).length === 0) {
      onApplyPresets(mapped);
    }
  };

  return (
    <div className="graph-settings" data-testid="graph-settings-root">
      <div className="graph-settings-section">
        <div className="graph-settings-title">Graph Contract</div>
        <div className="contract-group">
          <div className="contract-header">
            <div className="contract-label">Inputs</div>
            <button className="button" onClick={() => addContractItem("inputs")} data-testid="contract-add-input">
              Add Input
            </button>
          </div>
          {draft.inputs.length === 0 && <div className="contract-empty">No inputs.</div>}
          {draft.inputs.map((item, index) => (
            <div key={`input-${index}`} className="contract-row">
              <input
                value={item.name}
                placeholder="name"
                data-testid={`contract-input-name-${index}`}
                onChange={(event) => updateContractItem("inputs", index, { name: event.target.value })}
              />
              <select
                value={item.type}
                data-testid={`contract-input-type-${index}`}
                onChange={(event) =>
                  updateContractItem("inputs", index, { type: event.target.value as GraphContractPort["type"] })
                }
              >
                {dataTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="contract-check">
                <input
                  type="checkbox"
                  checked={Boolean(item.required)}
                  data-testid={`contract-input-required-${index}`}
                  onChange={(event) => updateContractItem("inputs", index, { required: event.target.checked })}
                />
                Required
              </label>
              <input
                value={item.description ?? ""}
                placeholder="description"
                data-testid={`contract-input-description-${index}`}
                onChange={(event) => updateContractItem("inputs", index, { description: event.target.value })}
              />
              {item.type === "json" ? (
                <textarea
                  value={typeof item.defaultValue === "string" ? item.defaultValue : JSON.stringify(item.defaultValue ?? null, null, 2)}
                  placeholder="default (json)"
                  data-testid={`contract-input-default-${index}`}
                  onChange={(event) => updateContractItem("inputs", index, { defaultValue: event.target.value })}
                />
              ) : (
                <input
                  value={item.defaultValue === undefined ? "" : String(item.defaultValue)}
                  placeholder="default"
                  data-testid={`contract-input-default-${index}`}
                  onChange={(event) => updateContractItem("inputs", index, { defaultValue: event.target.value })}
                />
              )}
              <textarea
                value={typeof item.examples === "string" ? item.examples : JSON.stringify(item.examples ?? [], null, 2)}
                placeholder="examples (json array)"
                data-testid={`contract-input-examples-${index}`}
                onChange={(event) => updateContractItem("inputs", index, { examples: event.target.value })}
              />
              <button className="button danger" onClick={() => removeContractItem("inputs", index)} data-testid={`contract-input-remove-${index}`}>
                Remove
              </button>
              {inputErrors[`${item.name}-default`] && (
                <div className="field-error" data-testid={`contract-input-error-default-${index}`}>
                  {inputErrors[`${item.name}-default`]}
                </div>
              )}
              {inputErrors[`${item.name}-examples`] && (
                <div className="field-error" data-testid={`contract-input-error-examples-${index}`}>
                  {inputErrors[`${item.name}-examples`]}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="contract-group">
          <div className="contract-header">
            <div className="contract-label">Outputs</div>
            <button className="button" onClick={() => addContractItem("outputs")} data-testid="contract-add-output">
              Add Output
            </button>
          </div>
          {draft.outputs.length === 0 && <div className="contract-empty">No outputs.</div>}
          {draft.outputs.map((item, index) => (
            <div key={`output-${index}`} className="contract-row">
              <input
                value={item.name}
                placeholder="name"
                data-testid={`contract-output-name-${index}`}
                onChange={(event) => updateContractItem("outputs", index, { name: event.target.value })}
              />
              <select
                value={item.type}
                data-testid={`contract-output-type-${index}`}
                onChange={(event) =>
                  updateContractItem("outputs", index, { type: event.target.value as GraphContractPort["type"] })
                }
              >
                {dataTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="contract-check">
                <input
                  type="checkbox"
                  checked={item.required ?? true}
                  data-testid={`contract-output-required-${index}`}
                  onChange={(event) => updateContractItem("outputs", index, { required: event.target.checked })}
                />
                Required
              </label>
              <input
                value={item.description ?? ""}
                placeholder="description"
                data-testid={`contract-output-description-${index}`}
                onChange={(event) => updateContractItem("outputs", index, { description: event.target.value })}
              />
              <textarea
                value={typeof item.examples === "string" ? item.examples : JSON.stringify(item.examples ?? [], null, 2)}
                placeholder="examples (json array)"
                data-testid={`contract-output-examples-${index}`}
                onChange={(event) => updateContractItem("outputs", index, { examples: event.target.value })}
              />
              <button className="button danger" onClick={() => removeContractItem("outputs", index)} data-testid={`contract-output-remove-${index}`}>
                Remove
              </button>
              {inputErrors[`${item.name}-examples`] && (
                <div className="field-error" data-testid={`contract-output-error-examples-${index}`}>
                  {inputErrors[`${item.name}-examples`]}
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          className="button primary"
          onClick={applyContract}
          data-testid="contract-apply"
        >
          Apply Contract
        </button>
      </div>
      <div className="graph-settings-section">
        <div className="graph-settings-title">Graph Inputs</div>
        {contract.inputs.length === 0 && <div className="contract-empty">No inputs defined.</div>}
        {contract.inputs.map((input) => (
          <div key={`input-val-${input.name}`} className="contract-row">
            <div className="contract-name">{input.name}</div>
            {input.type === "json" ? (
              <textarea
                value={inputDraft[input.name] ?? ""}
                data-testid={`graph-input-${input.name}`}
                onChange={(event) =>
                  setInputDraft((prev) => ({ ...prev, [input.name]: event.target.value }))
                }
              />
            ) : (
              <input
                value={inputDraft[input.name] ?? ""}
                placeholder={input.type}
                data-testid={`graph-input-${input.name}`}
                onChange={(event) =>
                  setInputDraft((prev) => ({ ...prev, [input.name]: event.target.value }))
                }
              />
            )}
            {inputErrors[input.name] && (
              <div className="field-error" data-testid={`graph-input-error-${input.name}`}>
                {inputErrors[input.name]}
              </div>
            )}
          </div>
        ))}
        <button className="button" onClick={applyInputs} data-testid="graph-inputs-apply">
          Apply Inputs
        </button>
      </div>
      <div className="graph-settings-section">
        <div className="graph-settings-title">Presets</div>
        {presetDraft.length === 0 && <div className="contract-empty">No presets.</div>}
        {presetDraft.map((preset, index) => (
          <div key={preset.id} className="contract-row preset-row">
            <input
              value={preset.title}
              placeholder="title"
              data-testid={`preset-title-${index}`}
              onChange={(event) => updatePreset(index, { title: event.target.value })}
            />
            <input
              value={preset.description ?? ""}
              placeholder="description"
              data-testid={`preset-description-${index}`}
              onChange={(event) => updatePreset(index, { description: event.target.value })}
            />
            <textarea
              value={preset.inputs}
              placeholder="inputs (json)"
              data-testid={`preset-inputs-${index}`}
              onChange={(event) => updatePreset(index, { inputs: event.target.value })}
            />
            <button className="button danger" onClick={() => removePreset(index)} data-testid={`preset-remove-${index}`}>
              Remove
            </button>
            {inputErrors[preset.id] && (
              <div className="field-error" data-testid={`preset-error-${index}`}>
                {inputErrors[preset.id]}
              </div>
            )}
          </div>
        ))}
        <div className="preset-actions">
          <button className="button" onClick={addPreset} data-testid="preset-add">
            Add Preset
          </button>
          <button className="button primary" onClick={applyPresets} data-testid="preset-apply">
            Apply Presets
          </button>
        </div>
      </div>
    </div>
  );
};
