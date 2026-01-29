// 文件说明：自动补充文件级注释，描述模块职责与用途

// 运行轨迹面板：展示执行历史并支持复制
import type { RunMeta, TraceEntry } from "../engine/runtime";
import { formatTraceJson } from "./traceUtils";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

// 轨迹面板参数
type TracePanelProps = {
  trace: TraceEntry[];
  runMeta: RunMeta;
  runningNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
};

// 轨迹面板组件
export const TracePanel = ({ trace, runMeta, runningNodeId, onSelectNode }: TracePanelProps) => {
  // 复制轨迹 JSON 到剪贴板
  const handleCopy = async () => {
    const payload = formatTraceJson(runMeta, trace);
    await navigator.clipboard.writeText(payload);
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "background.default" }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Execution Trace</Typography>
          <Typography variant="caption" color="text.secondary">{trace.length} entries</Typography>
        </Box>
        <Button 
            startIcon={<ContentCopyIcon fontSize="small" />} 
            size="small" 
            onClick={handleCopy} 
            data-testid="copy-trace"
            sx={{ textTransform: "none", fontSize: "0.75rem" }}
        >
          Copy JSON
        </Button>
      </Box>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" label={`Graph: ${runMeta.graphId}@${runMeta.graphVersion}`} variant="outlined" />
            <Chip size="small" label={`Preset: ${runMeta.presetId ?? "None"}`} variant="outlined" />
            <Chip size="small" label={`Choices: ${runMeta.choices.length}`} variant="outlined" />
        </Stack>
      </Box>
      <List sx={{ flexGrow: 1, overflow: "auto", p: 0 }} dense>
        {trace.length === 0 && (
           <Box sx={{ p: 4, textAlign: "center" }}>
             <Typography variant="body2" color="text.secondary">No execution history available.</Typography>
           </Box>
        )}
        {trace.map((entry, index) => (
          <ListItem
            key={`${entry.runId}-${entry.seq}-${index}`}
            alignItems="flex-start"
            sx={{ 
                borderBottom: 1, 
                borderColor: "divider",
                bgcolor:
                  entry.nodeId === runningNodeId
                    ? "info.lighter"
                    : entry.error
                      ? "error.lighter"
                      : "transparent",
                px: 2, py: 1,
                cursor: onSelectNode ? "pointer" : "default"
            }}
            onClick={() => onSelectNode?.(entry.nodeId)}
          >
            <ListItemText
              primary={
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {entry.error ? <ErrorOutlineIcon fontSize="small" color="error" /> : <CheckCircleOutlineIcon fontSize="small" color="success" sx={{ opacity: 0.7 }} />}
                        <Typography variant="caption" fontWeight="bold" fontFamily="monospace" sx={{ color: "text.primary" }}>
                            #{entry.seq} · {entry.nodeId}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {entry.durationMs.toFixed(2)}ms
                    </Typography>
                </Box>
              }
              secondary={
                <Stack spacing={0.5}>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip label={entry.type} size="small" sx={{ height: 16, fontSize: "0.65rem" }} />
                  </Box>
                  {entry.exec && (
                    <Box sx={{ 
                        mt: 0.5, 
                        p: 1, 
                        bgcolor: "action.hover", 
                        borderRadius: 1, 
                        borderLeft: "2px solid", 
                        borderColor: "primary.main" 
                    }}>
                        <Typography variant="caption" sx={{ fontFamily: "Fira Code, monospace", whiteSpace: "pre-wrap", display: "block", color: "text.secondary" }}>
                            {entry.exec}
                        </Typography>
                    </Box>
                  )}
                  {entry.error && (
                    <Typography variant="caption" color="error" fontWeight={500} sx={{ mt: 0.5, display: "block" }}>
                        Error: {entry.error}
                    </Typography>
                  )}
                </Stack>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
