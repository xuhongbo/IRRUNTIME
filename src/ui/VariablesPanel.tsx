// 文件说明：自动补充文件级注释，描述模块职责与用途

// 变量面板：展示运行时变量与筛选
import React, { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import { splitVarName } from "../engine/vars";

// 变量面板参数
type VariablesPanelProps = {
  vars: Record<string, unknown>;
};

// 格式化变量值为可读文本
const formatValue = (value: unknown) => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

// 变量面板组件
export const VariablesPanel = ({ vars }: VariablesPanelProps) => {
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => {
    return Object.entries(vars).sort(([a], [b]) => a.localeCompare(b));
  }, [vars]);
  const namespaces = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(vars)) {
      const { namespace } = splitVarName(key);
      set.add(namespace);
    }
    return Array.from(set).sort();
  }, [vars]);

  const filtered = entries.filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" fontWeight={700}>
          变量
        </Typography>
        <TextField
          size="small"
          placeholder="筛选变量..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        />
        {namespaces.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            {namespaces.map((ns) => (
              <Chip key={ns} size="small" label={ns} />
            ))}
          </Stack>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
        {filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无变量
          </Typography>
        ) : (
          <Stack spacing={1}>
            {filtered.map(([key, value]) => (
              <Paper key={key} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {key}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "monospace" }}
                >
                  {formatValue(value)}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
};
