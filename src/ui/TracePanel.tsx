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
  const typeLabelMap: Record<string, string> = {
    Start: "开始",
    End: "结束",
    GraphInput: "图输入",
    GraphOutput: "图输出",
    Script: "脚本",
    SetVar: "设置变量",
    GetVar: "读取变量",
    If: "条件判断",
    Equals: "相等比较",
    ConstString: "字符串常量",
    ConstNumber: "数字常量",
    ConstBoolean: "布尔常量",
    ConstJson: "JSON 常量",
    ToNumber: "转为数字",
    ToString: "转为字符串",
    ShowText: "展示文本",
    WaitForChoice: "等待选择",
    Delay: "延迟",
    Expression: "表达式",
    Divide: "除法",
    Subgraph: "子图",
  };

  // 复制轨迹 JSON 到剪贴板
  const handleCopy = async () => {
    const payload = formatTraceJson(runMeta, trace);
    await navigator.clipboard.writeText(payload);
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "background.default" }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>执行轨迹</Typography>
          <Typography variant="caption" color="text.secondary">{trace.length} 条记录</Typography>
        </Box>
        <Button 
            startIcon={<ContentCopyIcon fontSize="small" />} 
            size="small" 
            onClick={handleCopy} 
            data-testid="copy-trace"
            sx={{ textTransform: "none", fontSize: "0.75rem" }}
        >
          复制 JSON
        </Button>
      </Box>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" label={`图：${runMeta.graphId}@${runMeta.graphVersion}`} variant="outlined" />
            <Chip size="small" label={`预设：${runMeta.presetId ?? "无"}`} variant="outlined" />
            <Chip size="small" label={`选择次数：${runMeta.choices.length}`} variant="outlined" />
        </Stack>
      </Box>
      <List sx={{ flexGrow: 1, overflow: "auto", p: 0 }} dense>
        {trace.length === 0 && (
           <Box sx={{ p: 4, textAlign: "center" }}>
             <Typography variant="body2" color="text.secondary">暂无执行历史。</Typography>
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
                    <Chip label={typeLabelMap[entry.type] ?? entry.type} size="small" sx={{ height: 16, fontSize: "0.65rem" }} />
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
                        错误：{entry.error}
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
