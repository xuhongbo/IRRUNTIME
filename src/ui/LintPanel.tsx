import type { LintIssue } from "../studio/lint";
import "./LintPanel.css";

type LintPanelProps = {
  issues: LintIssue[];
  onFix: (issue: LintIssue) => void;
  onFocusNode: (nodeId: string) => void;
};

export const LintPanel = ({ issues, onFix, onFocusNode }: LintPanelProps) => {
  return (
    <div className="lint-panel">
      <div className="lint-header">
        <div>
          <div className="lint-title">建议</div>
          <div className="lint-subtitle">{issues.length} 条建议</div>
        </div>
      </div>
      {issues.length === 0 && <div className="lint-empty">暂无建议。</div>}
      <div className="lint-list">
        {issues.map((issue) => (
          <div key={issue.id} className={`lint-item ${issue.severity}`}>
            <div className="lint-message">
              {issue.nodeId && (
                <button className="link" onClick={() => onFocusNode(issue.nodeId!)}>
                  {issue.nodeId}
                </button>
              )}
              {issue.message}
            </div>
            {issue.fix && (
              <button className="button" onClick={() => onFix(issue)}>
                {issue.fix.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
