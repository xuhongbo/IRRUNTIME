import { useMemo, useRef, useState } from "react";
import type { Graph, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { createNodeInstance, listPaletteItems } from "../studio/nodeFactory";
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

type PaletteProps = {
  graph: Graph;
  registry: Registry;
  center: NodePosition;
  onAddNode: (node: Graph["nodes"][number]) => void;
};

const getNodeIcon = (type: string) => {
  if (type.startsWith("Const") || type.startsWith("To")) return <DataObjectIcon fontSize="small" sx={{ color: "primary.main" }} />;
  if (type === "If" || type === "Equals" || type === "WaitForChoice") return <CallSplitIcon fontSize="small" sx={{ color: "secondary.main" }} />;
  if (type === "Start" || type === "End") return <PlayArrowIcon fontSize="small" sx={{ color: "success.main" }} />;
  if (type === "Delay") return <AccessTimeIcon fontSize="small" sx={{ color: "warning.main" }} />;
  if (type === "Script") return <CodeIcon fontSize="small" sx={{ color: "info.main" }} />;
  return <WidgetsIcon fontSize="small" sx={{ color: "text.secondary" }} />;
};

export const Palette = ({ graph, registry, center, onAddNode }: PaletteProps) => {
  const [query, setQuery] = useState("");
  const addCounterRef = useRef(0);

  const items = useMemo(() => {
    const list = listPaletteItems(registry);
    const lower = query.trim().toLowerCase();
    if (!lower) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower)
    );
  }, [query, registry]);

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
      </Box>
      <Divider />
      <List sx={{ flexGrow: 1, overflow: "auto", px: 1 }} dense>
        {items.map((item) => (
          <ListItemButton
            key={`${item.type}@${item.version}`}
            onClick={() => handleAdd(item.type, item.version)}
            data-testid={`palette-${item.type}@${item.version}`}
            sx={{ 
                mb: 0.5, 
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" }
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
                {getNodeIcon(item.type)}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              secondary={item.type}
              primaryTypographyProps={{ variant: "body2", fontWeight: 500, color: "text.primary" }}
              secondaryTypographyProps={{ variant: "caption", color: "text.secondary", fontFamily: "monospace" }}
            />
          </ListItemButton>
        ))}
        {items.length === 0 && (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">未找到相关节点</Typography>
          </Box>
        )}
      </List>
    </Box>
  );
};
