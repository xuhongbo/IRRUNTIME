// 文件说明：自动补充文件级注释，描述模块职责与用途

// 图设置面板：编辑输入输出契约与预设
import React, { useEffect, useMemo, useState } from "react";
import type { GraphContract, GraphContractPort } from "../engine/ir";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";

// 图设置参数
type GraphSettingsProps = {
  contract: GraphContract;
  inputValues: Record<string, unknown>;
  onChangeInputs: (next: Record<string, unknown>) => void;
  onApplyContract: (contract: GraphContract) => void;
  presets: { id: string; title: string; description?: string; inputs: Record<string, unknown> }[];
  onApplyPresets: (presets: GraphSettingsProps["presets"]) => void;
};

// 支持的数据类型列表
const dataTypes: GraphContractPort["type"][] = ["string", "number", "boolean", "json"];
const typeLabels: Record<GraphContractPort["type"], string> = {
  string: "字符串",
  number: "数字",
  boolean: "布尔",
  json: "JSON",
};

// 图设置组件
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

  // 同步外部契约到草稿
  useEffect(() => {
    setDraft(contract);
  }, [contract]);

  // 同步外部输入值到文本草稿
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

  const renderContractRow = (item: GraphContractPort, index: number, kind: "inputs" | "outputs") => (
    <Paper key={`${kind}-${index}`} variant="outlined" sx={{ p: 2, mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
            <TextField 
                label="名称" size="small" value={item.name} 
                onChange={(e) => updateContractItem(kind, index, { name: e.target.value })} 
                data-testid={`contract-${kind}-name-${index}`}
            />
            <Select
                size="small"
                value={item.type}
                onChange={(e) => updateContractItem(kind, index, { type: e.target.value as any })}
                data-testid={`contract-${kind}-type-${index}`}
            >
                {dataTypes.map(t => <MenuItem key={t} value={t}>{typeLabels[t]}</MenuItem>)}
            </Select>
            <FormControlLabel 
                control={<Checkbox checked={Boolean(item.required)} onChange={(e) => updateContractItem(kind, index, { required: e.target.checked })} />} 
                label="必填" 
            />
             <TextField 
                label="描述" size="small" value={item.description ?? ""} fullWidth
                onChange={(e) => updateContractItem(kind, index, { description: e.target.value })} 
            />
            <IconButton color="error" onClick={() => removeContractItem(kind, index)}>
                <DeleteIcon />
            </IconButton>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
             {item.type === "json" ? (
                  <TextField 
                    label="默认值 (JSON)" size="small" fullWidth multiline rows={2}
                    value={typeof item.defaultValue === "string" ? item.defaultValue : JSON.stringify(item.defaultValue ?? null, null, 2)}
                    onChange={(e) => updateContractItem(kind, index, { defaultValue: e.target.value })}
                  />
             ) : (
                  <TextField 
                    label="默认值" size="small" fullWidth
                    value={item.defaultValue === undefined ? "" : String(item.defaultValue)}
                    onChange={(e) => updateContractItem(kind, index, { defaultValue: e.target.value })}
                  />
             )}
              <TextField 
                label="示例 (JSON Array)" size="small" fullWidth multiline rows={2}
                value={typeof item.examples === "string" ? item.examples : JSON.stringify(item.examples ?? [], null, 2)}
                onChange={(e) => updateContractItem(kind, index, { examples: e.target.value })}
              />
        </Stack>
    </Paper>
  );

  return (
    <Box sx={{ p: 2 }} data-testid="graph-settings-root">
      
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
             <Typography variant="h6">图合约</Typography>
        </AccordionSummary>
        <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>用于定义对外输入与输出，运行时校验与输出都会基于这里。</Typography>
            
            <Divider sx={{ my: 2 }}><Typography variant="caption">输入</Typography></Divider>
            {draft.inputs.map((item, index) => renderContractRow(item, index, "inputs"))}
            <Button startIcon={<AddIcon />} onClick={() => addContractItem("inputs")}>添加输入</Button>

            <Divider sx={{ my: 2 }}><Typography variant="caption">输出</Typography></Divider>
            {draft.outputs.map((item, index) => renderContractRow(item, index, "outputs"))}
            <Button startIcon={<AddIcon />} onClick={() => addContractItem("outputs")}>添加输出</Button>
            
            <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={applyContract} data-testid="contract-apply">应用合约</Button>
            </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
             <Typography variant="h6">运行输入</Typography>
        </AccordionSummary>
        <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>运行时会使用这里的输入值，可手动修改后点击应用。</Typography>
            {contract.inputs.length === 0 && <Typography color="text.secondary">未定义输入。</Typography>}
            <Stack spacing={2}>
            {contract.inputs.map((input) => (
                <TextField 
                    key={input.name}
                    label={`${input.name} (${typeLabels[input.type]})`}
                    size="small"
                    fullWidth
                    multiline={input.type === "json"}
                    value={inputDraft[input.name] ?? ""}
                    onChange={(e) => setInputDraft(prev => ({...prev, [input.name]: e.target.value}))}
                    error={!!inputErrors[input.name]}
                    helperText={inputErrors[input.name]}
                />
            ))}
            </Stack>
             <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={applyInputs} data-testid="graph-inputs-apply">应用输入</Button>
            </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
             <Typography variant="h6">预设</Typography>
        </AccordionSummary>
        <AccordionDetails>
            <Typography variant="body2" color="text.secondary" paragraph>保存一组输入值，运行时可快速切换。</Typography>
             {presetDraft.map((preset, index) => (
                 <Paper key={preset.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                     <Stack spacing={2}>
                        <Stack direction="row" spacing={2}>
                            <TextField label="标题" size="small" value={preset.title} onChange={(e) => updatePreset(index, { title: e.target.value })} />
                            <TextField label="说明" size="small" fullWidth value={preset.description ?? ""} onChange={(e) => updatePreset(index, { description: e.target.value })} />
                             <IconButton color="error" onClick={() => removePreset(index)}>
                                <DeleteIcon />
                            </IconButton>
                        </Stack>
                        <TextField 
                            label="输入 (JSON)" multiline rows={3} fullWidth 
                            value={preset.inputs} onChange={(e) => updatePreset(index, { inputs: e.target.value })}
                            error={!!inputErrors[preset.id]}
                            helperText={inputErrors[preset.id]}
                            sx={{ fontFamily: "monospace" }}
                        />
                     </Stack>
                 </Paper>
             ))}
             <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button startIcon={<AddIcon />} onClick={addPreset}>新增预设</Button>
                <Button variant="contained" onClick={applyPresets}>应用预设</Button>
             </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
