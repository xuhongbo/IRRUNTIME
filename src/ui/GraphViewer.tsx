// 文件说明：自动补充文件级注释，描述模块职责与用途

// 图画布视图：渲染 Rete 画布与顶部工具条
import type { Graph } from "../engine/ir";
import type { Registry } from "../engine/registry";
import type { Command } from "../studio/commands";
import { ReteCanvas } from "../studio/rete/ReteCanvas";
import type { ValidationError } from "../engine/validator";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";

import GridOnIcon from "@mui/icons-material/GridOn";
import GridOffIcon from "@mui/icons-material/GridOff";
import AlignHorizontalLeftIcon from "@mui/icons-material/AlignHorizontalLeft";
import AlignHorizontalCenterIcon from "@mui/icons-material/AlignHorizontalCenter";
import AlignHorizontalRightIcon from "@mui/icons-material/AlignHorizontalRight";
import AlignVerticalTopIcon from "@mui/icons-material/AlignVerticalTop";
import AlignVerticalCenterIcon from "@mui/icons-material/AlignVerticalCenter";
import AlignVerticalBottomIcon from "@mui/icons-material/AlignVerticalBottom";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DistributeHorizontalIcon from "@mui/icons-material/FormatAlignJustify"; // Approximation
import DistributeVerticalIcon from "@mui/icons-material/VerticalAlignCenter"; // Approximation

// 画布组件参数
type GraphViewerProps = {
  graph: Graph;
  registry: Registry;
  selectedNodeId: string | null;
  focusedPin: { nodeId: string; pinKey: string } | null;
  validationErrors: ValidationError[];
  runningNodeId: string | null;
  breakpoints: string[];
  selectedNodeIds?: string[];
  suppressDrag?: boolean;
  snapToGrid?: boolean;
  onToggleSnap?: () => void;
  onAlign?: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  onDistribute?: (mode: "horizontal" | "vertical") => void;
  onAutoLayout?: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
  onCommand: (command: Command) => void;
};

// 图画布组件
export const GraphViewer = ({
  graph,
  registry,
  selectedNodeId,
  focusedPin,
  validationErrors,
  runningNodeId,
  breakpoints,
  selectedNodeIds,
  suppressDrag,
  snapToGrid,
  onToggleSnap,
  onAlign,
  onDistribute,
  onAutoLayout,
  onSelectNode,
  onSelectNodes,
  onCommand,
}: GraphViewerProps) => {
  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", bgcolor: "#fafafa", overflow: "hidden" }}>
      <ReteCanvas
        graph={graph}
        registry={registry}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
        focusedPin={focusedPin}
        validationErrors={validationErrors}
        runningNodeId={runningNodeId}
        breakpoints={breakpoints}
        suppressDrag={suppressDrag}
        snapToGrid={snapToGrid}
        onCommand={onCommand}
        onSelectNode={onSelectNode}
        onSelectNodes={onSelectNodes}
      />
      
      {/* Overlay Toolbar */}
      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          p: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          zIndex: 10,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                {graph.id}
            </Typography>
            <Chip size="small" label={`${graph.nodes.length} 个节点`} variant="outlined" sx={{ height: 20, fontSize: "0.65rem", borderColor: "divider" }} />
        </Stack>
        <Divider orientation="vertical" flexItem />
        <ToggleButtonGroup size="small" exclusive>
          <Tooltip title="吸附到网格">
            <ToggleButton value="snap" selected={snapToGrid} onChange={onToggleSnap} sx={{ border: "none" }}>
               {snapToGrid ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
        
        <Divider orientation="vertical" flexItem />
        
        <ToggleButtonGroup size="small" sx={{ border: "none" }}>
            <Tooltip title="左对齐"><ToggleButton value="left" onClick={() => onAlign?.("left")} sx={{ border: "none" }}><AlignHorizontalLeftIcon fontSize="small"/></ToggleButton></Tooltip>
            <Tooltip title="水平居中"><ToggleButton value="centerX" onClick={() => onAlign?.("centerX")} sx={{ border: "none" }}><AlignHorizontalCenterIcon fontSize="small"/></ToggleButton></Tooltip>
            <Tooltip title="右对齐"><ToggleButton value="right" onClick={() => onAlign?.("right")} sx={{ border: "none" }}><AlignHorizontalRightIcon fontSize="small"/></ToggleButton></Tooltip>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        <ToggleButtonGroup size="small">
             <Tooltip title="顶部对齐"><ToggleButton value="top" onClick={() => onAlign?.("top")} sx={{ border: "none" }}><AlignVerticalTopIcon fontSize="small"/></ToggleButton></Tooltip>
             <Tooltip title="垂直居中"><ToggleButton value="centerY" onClick={() => onAlign?.("centerY")} sx={{ border: "none" }}><AlignVerticalCenterIcon fontSize="small"/></ToggleButton></Tooltip>
             <Tooltip title="底部对齐"><ToggleButton value="bottom" onClick={() => onAlign?.("bottom")} sx={{ border: "none" }}><AlignVerticalBottomIcon fontSize="small"/></ToggleButton></Tooltip>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="自动布局">
             <ToggleButtonGroup size="small">
                <ToggleButton value="auto" onClick={onAutoLayout} sx={{ border: "none" }}><AutoAwesomeIcon fontSize="small" /></ToggleButton>
             </ToggleButtonGroup>
        </Tooltip>
      </Paper>

      <Typography variant="caption" sx={{ position: "absolute", bottom: 8, left: 16, color: "text.disabled", userSelect: "none", pointerEvents: "none", opacity: 0.6 }}>
        拖拽平移 · 滚轮缩放 · Ctrl+点击多选
      </Typography>
    </Box>
  );
};
