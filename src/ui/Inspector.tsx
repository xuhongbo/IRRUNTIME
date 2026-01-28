import React, { useEffect, useMemo, useState } from "react";
import type { Graph, NodeIO } from "../engine/ir";
import type { FormFieldDef, Registry } from "../engine/registry";
import type { ValidationError } from "../engine/validator";
import { getNodePinStatus, groupNodeErrors } from "./inspectorUtils";
import { normalizeContract } from "../engine/contract";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BugReportIcon from "@mui/icons-material/BugReport";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Collapse from "@mui/material/Collapse";

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

const SectionHeader = ({ title, defaultOpen = true, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Box 
                onClick={() => setOpen(!open)} 
                sx={{ 
                    px: 2, 
                    py: 1.5, 
                    display: "flex", 
                    alignItems: "center", 
                    cursor: "pointer", 
                    "&:hover": { bgcolor: "action.hover" },
                    userSelect: "none"
                }}
            >
                {open ? <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary", mr: 1 }} /> : <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary", mr: 1 }} />}
                <Typography variant="subtitle2" fontWeight={600} color="text.primary">{title}</Typography>
            </Box>
            <Collapse in={open}>
                <Box sx={{ px: 2, pb: 2 }}>
                    {children}
                </Box>
            </Collapse>
        </Box>
    );
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
  const resolvedForm = useMemo<FormFieldDef[]>(() => {
    if (!node) return def?.form ?? [];
    if (!def) return [];
    if (node.type !== "GraphInput" && node.type !== "GraphOutput") {
      return def.form;
    }
    const contract = normalizeContract(graph.contract);
    const typeLabels: Record<string, string> = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      json: "JSON",
    };
    const options =
      node.type === "GraphInput"
        ? contract.inputs.map((item) => ({
            value: item.name,
            label: `${item.name} (${typeLabels[item.type] ?? item.type})`,
          }))
        : contract.outputs.map((item) => ({
            value: item.name,
            label: `${item.name} (${typeLabels[item.type] ?? item.type})`,
          }));
    return def.form.map((field) =>
      field.key === "name" ? { ...field, options } : field
    );
  }, [def, graph.contract, node]);

  useEffect(() => {
    if (node) {
      setDraftProps({ ...node.props });
      setJsonErrors({});
    }
  }, [node]);

  if (!node || !def) {
    return (
      <Box sx={{ p: 4, textAlign: "center", color: "text.secondary", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} data-testid="inspector-root">
        <Typography variant="body2">Select a node to inspect</Typography>
      </Box>
    );
  }

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
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }} data-testid="inspector-root">
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
                <Typography variant="subtitle1" fontWeight={700}>{node.type}</Typography>
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                    {node.id} <Typography component="span" variant="caption" sx={{ color: "text.disabled" }}>• v{node.version}</Typography>
                </Typography>
            </Box>
            <IconButton size="small" color="error" onClick={() => onDeleteNode(node.id)} title="Delete Node">
                <DeleteOutlineIcon fontSize="small" />
            </IconButton>
        </Stack>
        <Button
            size="small"
            variant={hasBreakpoint ? "contained" : "outlined"}
            color={hasBreakpoint ? "warning" : "inherit"}
            startIcon={<BugReportIcon fontSize="small" />}
            onClick={() => onToggleBreakpoint(node.id)}
            fullWidth
            sx={{ mt: 2, borderColor: "divider" }}
        >
            {hasBreakpoint ? "Breakpoint Active" : "Add Breakpoint"}
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        
        {errorGroups.nodeErrors.length > 0 && (
           <Box sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText" }}>
                {errorGroups.nodeErrors.map((err, index) => (
                    <Typography key={index} variant="body2" fontWeight={500} sx={{ display: "flex", gap: 1 }}>
                        • {err.message}
                    </Typography>
                ))}
           </Box>
        )}

        <SectionHeader title="Properties">
            <Stack spacing={2}>
                {resolvedForm.length === 0 && <Typography variant="body2" color="text.secondary" fontStyle="italic">No configurable properties.</Typography>}
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
                {resolvedForm.length > 0 && (
                    <Button variant="contained" onClick={apply} fullWidth disableElevation>
                        Apply Changes
                    </Button>
                )}
            </Stack>
        </SectionHeader>

        {pinStatus && (
             <SectionHeader title="Connections">
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <Box>
                         <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>INPUTS</Typography>
                         {pinStatus.inputs.length === 0 && <Typography variant="caption" color="text.disabled">None</Typography>}
                         <Stack spacing={0.5}>
                            {pinStatus.inputs.map(pin => (
                                <Box key={pin.key} sx={{ 
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    p: 0.5, borderRadius: 1, bgcolor: pin.connected ? "action.hover" : "transparent"
                                }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Box sx={{ 
                                            width: 8, height: 8, borderRadius: "50%", 
                                            bgcolor: pin.kind === "exec" ? "warning.main" : "info.main" 
                                        }} />
                                        <Typography variant="body2" fontSize="0.75rem">{pin.label}</Typography>
                                    </Box>
                                </Box>
                            ))}
                         </Stack>
                    </Box>
                    <Box>
                         <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>OUTPUTS</Typography>
                         {pinStatus.outputs.length === 0 && <Typography variant="caption" color="text.disabled">None</Typography>}
                         <Stack spacing={0.5}>
                            {pinStatus.outputs.map(pin => (
                                <Box key={pin.key} sx={{ 
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    p: 0.5, borderRadius: 1, bgcolor: pin.connected ? "action.hover" : "transparent"
                                }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Box sx={{ 
                                            width: 8, height: 8, borderRadius: "50%", 
                                            bgcolor: pin.kind === "exec" ? "warning.main" : "info.main" 
                                        }} />
                                        <Typography variant="body2" fontSize="0.75rem">{pin.label}</Typography>
                                    </Box>
                                </Box>
                            ))}
                         </Stack>
                    </Box>
                </Box>
             </SectionHeader>
        )}
        
        {io && (
             <SectionHeader title="Last Execution" defaultOpen={false}>
                 <Stack spacing={1}>
                     <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="caption" color="text.secondary">Duration</Typography>
                        <Typography variant="caption" fontFamily="monospace">{io.durationMs.toFixed(2)}ms</Typography>
                     </Box>
                     <Divider />
                     <Box>
                         <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Input Data</Typography>
                         <Box sx={{ bgcolor: "grey.50", p: 1, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ m: 0, overflow: "auto" }}>
                                {JSON.stringify(io.inputs, null, 2)}
                            </Typography>
                         </Box>
                     </Box>
                     <Box>
                         <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Output Data</Typography>
                         <Box sx={{ bgcolor: "grey.50", p: 1, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" fontFamily="monospace" component="pre" sx={{ m: 0, overflow: "auto" }}>
                                {JSON.stringify(io.outputs, null, 2)}
                            </Typography>
                         </Box>
                     </Box>
                     {io.error && (
                         <Alert severity="error" sx={{ mt: 1 }}>
                             {io.error}
                         </Alert>
                     )}
                 </Stack>
            </SectionHeader>
        )}
      </Box>
    </Box>
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

  switch (field.type) {
    case "string":
      return (
        <TextField
          id={id}
          label={field.label}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          helperText={error || field.helpText}
          error={!!error}
          fullWidth
          size="small"
        />
      );
    case "number":
      return (
         <TextField
          id={id}
          label={field.label}
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          helperText={error || field.helpText}
          error={!!error}
          fullWidth
          size="small"
        />
      );
    case "boolean":
      return (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
          label={<Typography variant="body2">{field.label}</Typography>}
        />
      );
    case "select":
      return (
        <TextField
            select
            id={id}
            label={field.label}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            helperText={error || field.helpText}
            error={!!error}
            fullWidth
            size="small"
        >
             {field.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
        </TextField>
      );
    case "textarea":
      return (
         <TextField
          id={id}
          label={field.label}
          multiline
          rows={3}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          helperText={error || field.helpText}
          error={!!error}
          fullWidth
          size="small"
        />
      );
    case "json":
    case "array": {
      const textValue = typeof value === "string" ? value : JSON.stringify(value ?? (field.type === "array" ? [] : {}), null, 2);
      return (
        <TextField
          id={id}
          label={field.label}
          multiline
          rows={4}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          helperText={error || field.helpText}
          error={!!error}
          fullWidth
          size="small"
          sx={{ fontFamily: "Fira Code, monospace", "& .MuiInputBase-input": { fontSize: "0.8rem" } }}
        />
      );
    }
    default:
      return null;
  }
};
