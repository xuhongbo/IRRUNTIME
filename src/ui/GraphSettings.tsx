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
const typeLabels: Record<GraphContractPort["type"], string> = {
  string: "字符串",
  number: "数字",
  boolean: "布尔",
  json: "JSON",
};

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
        errors[input.name] = "JSON 解析错误";
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
          errors[`${next.name}-default`] = "默认值 JSON 无效";
        } else {
          next.defaultValue = result.value;
        }
      } else if (next.type === "number" && typeof next.defaultValue === "string") {
        const value = Number(next.defaultValue);
        if (Number.isNaN(value)) {
          errors[`${next.name}-default`] = "默认值数字无效";
        } else {
          next.defaultValue = value;
        }
      } else if (next.type === "boolean" && typeof next.defaultValue === "string") {
        next.defaultValue = next.defaultValue === "true";
      }
      if (typeof next.examples === "string") {
        const result = parseJsonValue(next.examples);
        if (!result.ok || !Array.isArray(result.value)) {
          errors[`${next.name}-examples`] = "示例必须为 JSON 数组";
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
      { id: `preset-${Date.now()}`, title: "新预设", description: "", inputs: "{}" },
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
      const isObject =
        parsed.ok &&
        typeof parsed.value === "object" &&
        parsed.value !== null &&
        !Array.isArray(parsed.value);
      if (!isObject) {
        errors[preset.id] = "预设输入必须为 JSON 对象";
      }
      return {
        id: preset.id,
        title: preset.title,
        description: preset.description,
        inputs: isObject ? (parsed.value as Record<string, unknown>) : {},
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
        <div className="graph-settings-title">图合约</div>
        <div className="graph-settings-desc">用于定义对外输入与输出，运行时校验与输出都会基于这里。</div>
        <div className="contract-group">
          <div className="contract-header">
            <div className="contract-label">输入</div>
            <button className="button" onClick={() => addContractItem("inputs")} data-testid="contract-add-input">
              添加输入
            </button>
          </div>
          {draft.inputs.length === 0 && <div className="contract-empty">暂无输入。</div>}
          {draft.inputs.map((item, index) => (
            <div key={`input-${index}`} className="contract-row">
              <input
                value={item.name}
                placeholder="名称"
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
                    {typeLabels[type]}
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
                必填
              </label>
              <input
                value={item.description ?? ""}
                placeholder="描述"
                data-testid={`contract-input-description-${index}`}
                onChange={(event) => updateContractItem("inputs", index, { description: event.target.value })}
              />
              {item.type === "json" ? (
                <textarea
                  value={typeof item.defaultValue === "string" ? item.defaultValue : JSON.stringify(item.defaultValue ?? null, null, 2)}
                  placeholder="默认值（JSON）"
                  data-testid={`contract-input-default-${index}`}
                  onChange={(event) => updateContractItem("inputs", index, { defaultValue: event.target.value })}
                />
              ) : (
                <input
                  value={item.defaultValue === undefined ? "" : String(item.defaultValue)}
                  placeholder="默认值"
                  data-testid={`contract-input-default-${index}`}
                  onChange={(event) => updateContractItem("inputs", index, { defaultValue: event.target.value })}
                />
              )}
              <textarea
                value={typeof item.examples === "string" ? item.examples : JSON.stringify(item.examples ?? [], null, 2)}
                placeholder="示例（JSON 数组）"
                data-testid={`contract-input-examples-${index}`}
                onChange={(event) => updateContractItem("inputs", index, { examples: event.target.value })}
              />
              <button className="button danger" onClick={() => removeContractItem("inputs", index)} data-testid={`contract-input-remove-${index}`}>
                移除
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
            <div className="contract-label">输出</div>
            <button className="button" onClick={() => addContractItem("outputs")} data-testid="contract-add-output">
              添加输出
            </button>
          </div>
          {draft.outputs.length === 0 && <div className="contract-empty">暂无输出。</div>}
          {draft.outputs.map((item, index) => (
            <div key={`output-${index}`} className="contract-row">
              <input
                value={item.name}
                placeholder="名称"
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
                    {typeLabels[type]}
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
                必填
              </label>
              <input
                value={item.description ?? ""}
                placeholder="描述"
                data-testid={`contract-output-description-${index}`}
                onChange={(event) => updateContractItem("outputs", index, { description: event.target.value })}
              />
              <textarea
                value={typeof item.examples === "string" ? item.examples : JSON.stringify(item.examples ?? [], null, 2)}
                placeholder="示例（JSON 数组）"
                data-testid={`contract-output-examples-${index}`}
                onChange={(event) => updateContractItem("outputs", index, { examples: event.target.value })}
              />
              <button className="button danger" onClick={() => removeContractItem("outputs", index)} data-testid={`contract-output-remove-${index}`}>
                移除
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
          应用合约
        </button>
      </div>
      <div className="graph-settings-section">
        <div className="graph-settings-title">运行输入</div>
        <div className="graph-settings-desc">运行时会使用这里的输入值，可手动修改后点击应用。</div>
        {contract.inputs.length === 0 && <div className="contract-empty">未定义输入。</div>}
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
                placeholder={typeLabels[input.type]}
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
          应用输入
        </button>
      </div>
      <div className="graph-settings-section">
        <div className="graph-settings-title">预设</div>
        <div className="graph-settings-desc">保存一组输入值，运行时可快速切换。</div>
        {presetDraft.length === 0 && <div className="contract-empty">暂无预设。</div>}
        {presetDraft.map((preset, index) => (
          <div key={preset.id} className="contract-row preset-row">
            <input
              value={preset.title}
              placeholder="标题"
              data-testid={`preset-title-${index}`}
              onChange={(event) => updatePreset(index, { title: event.target.value })}
            />
            <input
              value={preset.description ?? ""}
              placeholder="说明"
              data-testid={`preset-description-${index}`}
              onChange={(event) => updatePreset(index, { description: event.target.value })}
            />
            <textarea
              value={preset.inputs}
              placeholder="输入（JSON）"
              data-testid={`preset-inputs-${index}`}
              onChange={(event) => updatePreset(index, { inputs: event.target.value })}
            />
            <button className="button danger" onClick={() => removePreset(index)} data-testid={`preset-remove-${index}`}>
              移除
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
            新增预设
          </button>
          <button className="button primary" onClick={applyPresets} data-testid="preset-apply">
            应用预设
          </button>
        </div>
      </div>
    </div>
  );
};
