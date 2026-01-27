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
          <div className="trace-title">Trace</div>
          <div className="trace-subtitle">{trace.length} entries</div>
        </div>
        <button className="button" onClick={handleCopy} data-testid="copy-trace">
          Copy JSON
        </button>
      </div>
      <div className="trace-meta">
        <div>Graph: {runMeta.graphId}@{runMeta.graphVersion}</div>
        <div>Preset: {runMeta.presetId ?? "(none)"}</div>
        <div>Choices: {runMeta.choices.length}</div>
      </div>
      <div className="trace-list">
        {trace.length === 0 && <div className="trace-empty">No execution yet.</div>}
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
              <div>Exec: {entry.exec ?? "(none)"}</div>
              {entry.error && <div className="trace-error">Error: {entry.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
