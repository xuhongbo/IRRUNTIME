// 文件说明：自动补充文件级注释，描述模块职责与用途

// 节点面板：搜索并添加节点到画布
import { useMemo, useRef, useState } from "react";
import type { Graph, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { createNodeInstance, listDataPaletteItems, listFlowPaletteItems, type NodeCategory } from "../studio/nodeFactory";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import ListItemIcon from "@mui/material/ListItemIcon";
import CodeIcon from "@mui/icons-material/Code";
import DataObjectIcon from "@mui/icons-material/DataObject";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WidgetsIcon from "@mui/icons-material/Widgets";
import Switch from "@mui/material/Switch";

// 面板参数
type PaletteProps = {
  graph: Graph;
  registry: Registry;
  center: NodePosition;
  onAddNode: (node: Graph["nodes"][number]) => void;
};

// 根据节点类型返回图标
const getNodeIcon = (type: string) => {
  if (type.startsWith("Const") || type.startsWith("To")) return <DataObjectIcon fontSize="small" sx={{ color: "primary.main" }} />;
  if (type === "If" || type === "Equals" || type === "WaitForChoice") return <CallSplitIcon fontSize="small" sx={{ color: "secondary.main" }} />;
  if (type === "Start" || type === "End") return <PlayArrowIcon fontSize="small" sx={{ color: "success.main" }} />;
  if (type === "Delay") return <AccessTimeIcon fontSize="small" sx={{ color: "warning.main" }} />;
  if (type === "Script") return <CodeIcon fontSize="small" sx={{ color: "info.main" }} />;
  return <WidgetsIcon fontSize="small" sx={{ color: "text.secondary" }} />;
};

// 节点面板组件
export const Palette = ({ graph, registry, center, onAddNode }: PaletteProps) => {
  const [query, setQuery] = useState("");
  const [showDataNodes, setShowDataNodes] = useState(false);
  const addCounterRef = useRef(0);

  const items = useMemo(() => {
    const list = listFlowPaletteItems(registry);
    const lower = query.trim().toLowerCase();
    if (!lower) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower)
    );
  }, [query, registry]);

  const dataItems = useMemo(() => {
    if (!showDataNodes) return [];
    const list = listDataPaletteItems(registry);
    const lower = query.trim().toLowerCase();
    if (!lower) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower)
    );
  }, [query, registry, showDataNodes]);

  const grouped = useMemo(() => {
    const groups = new Map<NodeCategory, typeof items>();
    for (const item of items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return groups;
  }, [items]);

  const groupedData = useMemo(() => {
    const groups = new Map<NodeCategory, typeof dataItems>();
    for (const item of dataItems) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return groups;
  }, [dataItems]);

  const handleAdd = (type: string, version: number) => {
    const offset = addCounterRef.current * 24;
    addCounterRef.current += 1;
    const pos = { x: center.x + offset, y: center.y + offset };
    const node = createNodeInstance(type, registry, pos, graph.nodes.length + addCounterRef.current);
    onAddNode(node);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: "text.primary" }}>
          节点库
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ 
            "& .MuiOutlinedInput-root": { 
                bgcolor: "background.default",
                fontSize: "0.875rem"
            } 
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            显示数据节点
          </Typography>
          <Switch
            size="small"
            checked={showDataNodes}
            onChange={(event) => setShowDataNodes(event.target.checked)}
          />
        </Box>
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, overflow: "auto", px: 1 }} dense>
        {Array.from(grouped.entries()).map(([category, list]) => (
          <Box key={category} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ px: 1, py: 0.5, color: "text.secondary", fontWeight: 700 }}>
              {category}
            </Typography>
            {list.map((item) => (
              <ListItemButton
                key={`${item.type}@${item.version}`}
                onClick={() => handleAdd(item.type, item.version)}
                data-testid={`palette-${item.type}@${item.version}`}
                sx={{
                  mb: 0.5,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getNodeIcon(item.type)}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  secondary={`版本：v${item.version}`}
                  primaryTypographyProps={{ variant: "body2", fontWeight: 500, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "caption", color: "text.secondary", fontFamily: "monospace" }}
                />
              </ListItemButton>
            ))}
          </Box>
        ))}
        {showDataNodes && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ px: 1, py: 0.5, color: "text.secondary", fontWeight: 700 }}>
              数据节点
            </Typography>
            {Array.from(groupedData.entries()).map(([category, list]) => (
              <Box key={`data-${category}`} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ px: 1, py: 0.5, color: "text.disabled" }}>
                  {category}
                </Typography>
                {list.map((item) => (
                  <ListItemButton
                    key={`data-${item.type}@${item.version}`}
                    onClick={() => handleAdd(item.type, item.version)}
                    data-testid={`palette-data-${item.type}@${item.version}`}
                    sx={{
                      mb: 0.5,
                      borderRadius: 1,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {getNodeIcon(item.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={`版本：v${item.version}`}
                      primaryTypographyProps={{ variant: "body2", fontWeight: 500, color: "text.primary" }}
                      secondaryTypographyProps={{ variant: "caption", color: "text.secondary", fontFamily: "monospace" }}
                    />
                  </ListItemButton>
                ))}
              </Box>
            ))}
          </Box>
        )}
        {items.length === 0 && dataItems.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">未找到相关节点</Typography>
          </Box>
        )}
      </List>
    </Box>
  );
};
