import type { LintIssue } from "../studio/lint";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";

type LintPanelProps = {
  issues: LintIssue[];
  onFix: (issue: LintIssue) => void;
  onFocusNode: (nodeId: string) => void;
};

export const LintPanel = ({ issues, onFix, onFocusNode }: LintPanelProps) => {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle1">建议</Typography>
          <Typography variant="caption" color="text.secondary">{issues.length} 条建议</Typography>
      </Box>
      <List sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
        {issues.length === 0 && (
             <Box sx={{ textAlign: "center" }}>
               <Typography variant="body2" color="text.secondary">暂无建议。</Typography>
             </Box>
        )}
        {issues.map((issue) => (
          <ListItem key={issue.id} disablePadding sx={{ mb: 1 }}>
             <Alert 
                severity={issue.severity === "error" ? "error" : "warning"} 
                sx={{ width: "100%" }}
                action={
                    issue.fix ? (
                        <Button color="inherit" size="small" onClick={() => onFix(issue)}>
                            {issue.fix.label}
                        </Button>
                    ) : null
                }
             >
                <AlertTitle>
                    {issue.nodeId && (
                        <Typography 
                            component="span" 
                            variant="subtitle2" 
                            sx={{ cursor: "pointer", textDecoration: "underline", mr: 1 }}
                            onClick={() => onFocusNode(issue.nodeId!)}
                        >
                            {issue.nodeId}
                        </Typography>
                    )}
                </AlertTitle>
                {issue.message}
             </Alert>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
