import type { ViewModel } from "../engine/viewModel";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";

type RunnerProps = {
  viewModel: ViewModel | null;
  status: string;
  outputs?: Record<string, unknown>;
  presets?: { id: string; title: string }[];
  selectedPresetId?: string | null;
  onSelectPreset?: (presetId: string) => void;
  onNext: () => void;
  onChoose: (choiceKey: string) => void;
};

export const Runner = ({
  viewModel,
  status,
  outputs,
  presets,
  selectedPresetId,
  onSelectPreset,
  onNext,
  onChoose,
}: RunnerProps) => {
  const renderPresets = () => (
    <>
      {presets && presets.length > 0 && (
        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
            <InputLabel id="preset-label">Preset</InputLabel>
            <Select
                labelId="preset-label"
                label="Preset"
                value={selectedPresetId ?? presets[0]?.id}
                onChange={(event) => onSelectPreset?.(event.target.value)}
            >
                {presets.map((preset) => (
                    <MenuItem key={preset.id} value={preset.id}>
                        {preset.title}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
      )}
    </>
  );

  const renderOutputs = () => (
      <>
        {outputs && Object.keys(outputs).length > 0 && (
          <Box sx={{ mt: 2 }}>
             <Divider sx={{ my: 1 }} />
            <Typography variant="caption" fontWeight="bold" color="text.secondary">OUTPUTS</Typography>
            <Box sx={{ bgcolor: "grey.100", p: 1, borderRadius: 1, overflow: "auto", maxHeight: 150, fontSize: "0.75rem", fontFamily: "Fira Code, monospace", border: "1px solid", borderColor: "divider" }}>
                {JSON.stringify(outputs, null, 2)}
            </Box>
          </Box>
        )}
      </>
  );

  if (!viewModel) {
    return (
      <Box sx={{ height: "100%", overflow: "auto", p: 2 }} data-testid="runner-root">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Runner</Typography>
            <Chip 
                label={status} 
                size="small" 
                color={status === "running" ? "success" : "default"} 
                variant="outlined" 
                sx={{ textTransform: "uppercase", fontWeight: 600, fontSize: "0.7rem" }}
            />
        </Box>
        <Alert severity="info" variant="outlined" sx={{ borderStyle: "dashed" }}>
            Ready to run. Select a preset or click Run.
        </Alert>
        {renderPresets()}
        {renderOutputs()}
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: 2 }} data-testid="runner-root">
      <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ pb: 1 }}>
              <Typography variant="h6" gutterBottom fontSize="1.1rem">{viewModel.title}</Typography>
              <Typography variant="body2" color="text.secondary">{viewModel.body}</Typography>
              
              {viewModel.kind === "waiting" && <Alert severity="info" sx={{ mt: 2 }}>Waiting for async process...</Alert>}
              {viewModel.kind === "error" && <Alert severity="error" sx={{ mt: 2 }}>Execution Terminated.</Alert>}
              {viewModel.kind === "done" && <Alert severity="success" sx={{ mt: 2 }}>Flow Completed.</Alert>}
          </CardContent>
          {(viewModel.kind === "choice" || viewModel.kind === "text") && (
            <CardActions sx={{ flexWrap: "wrap", gap: 1, px: 2, pb: 2 }}>
                {viewModel.kind === "choice" && viewModel.choices.map((choice) => (
                    <Button
                        key={choice.key}
                        variant="contained"
                        size="small"
                        onClick={() => onChoose(choice.key)}
                        data-testid={`runner-choice-${choice.key}`}
                        disableElevation
                    >
                        {choice.label}
                    </Button>
                ))}
                {viewModel.kind === "text" && (
                     <Button variant="contained" size="small" onClick={onNext} data-testid="runner-next" disableElevation>
                        Next
                    </Button>
                )}
            </CardActions>
          )}
      </Card>
      
      {renderPresets()}
      {renderOutputs()}
    </Box>
  );
};
