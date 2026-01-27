import type { RunMeta, TraceEntry } from "../engine/runtime";
import { formatTraceJson } from "./traceUtils";
import "./TracePanel.css";

type TracePanelProps = {
  trace: TraceEntry[];
  runMeta: RunMeta;
};

export const TracePanel = ({ trace, runMeta }: TracePanelProps) => {
  const handleCopy = async () => {
    const payload = formatTraceJson(runMeta, trace);
    await navigator.clipboard.writeText(payload);
  };

  return (
    <div className="trace-panel">
      <div className="trace-header">
        <div>
          <div className="trace-title">执行轨迹</div>
          <div className="trace-subtitle">{trace.length} 条记录</div>
        </div>
        <button className="button" onClick={handleCopy} data-testid="copy-trace">
          复制 JSON
        </button>
      </div>
      <div className="trace-meta">
        <div>图：{runMeta.graphId}@{runMeta.graphVersion}</div>
        <div>预设：{runMeta.presetId ?? "（无）"}</div>
        <div>选择次数：{runMeta.choices.length}</div>
      </div>
      <div className="trace-list">
        {trace.length === 0 && <div className="trace-empty">暂无执行记录。</div>}
        {trace.map((entry) => (
          <div key={`${entry.runId}-${entry.seq}`} className={`trace-entry ${entry.error ? "error" : ""}`}>
            <div className="trace-main">
              <div>
                <div className="trace-node">
                  #{entry.seq} · {entry.nodeId}
                </div>
                <div className="trace-type">{entry.type}</div>
              </div>
              <div className="trace-time">{entry.durationMs.toFixed(2)} ms</div>
            </div>
            <div className="trace-details">
              <div>执行输出：{entry.exec ?? "（无）"}</div>
              {entry.error && <div className="trace-error">错误：{entry.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
