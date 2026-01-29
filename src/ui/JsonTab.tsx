// 文件说明：自动补充文件级注释，描述模块职责与用途

// JSON 编辑面板：直接编辑图结构
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import SyncIcon from "@mui/icons-material/Sync";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";

// JSON 面板参数
type JsonTabProps = {
  draft: string;
  error: string | null;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

// JSON 面板组件
export const JsonTab = ({ draft, error, onChange, onApply, onReset }: JsonTabProps) => {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }} data-testid="json-tab">
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
            <Typography variant="h6">图 JSON</Typography>
            <Typography variant="body2" color="text.secondary">可直接编辑并应用到画布。</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<SyncIcon />} onClick={onReset} data-testid="sync-json">
            从图同步
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={onApply} data-testid="apply-json">
            应用 JSON
          </Button>
        </Stack>
      </Box>
      <Box sx={{ flexGrow: 1, p: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
         <TextField
            multiline
            fullWidth
            value={draft}
            onChange={(event) => onChange(event.target.value)}
            error={!!error}
            helperText={error}
            sx={{ 
                flexGrow: 1, 
                "& .MuiInputBase-root": { height: "100%", alignItems: "flex-start", fontFamily: "monospace" },
                "& .MuiInputBase-input": { height: "100% !important", overflow: "auto !important" }
            }}
            slotProps={{
                input: {
                    id: "json-editor",
                    name: "json-editor",
                    "data-testid": "json-editor",
                    spellCheck: false,
                }
            }}
          />
      </Box>
    </Box>
  );
};
