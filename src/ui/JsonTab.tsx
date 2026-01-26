import "./JsonTab.css";

type JsonTabProps = {
  draft: string;
  error: string | null;
  onChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export const JsonTab = ({ draft, error, onChange, onApply, onReset }: JsonTabProps) => {
  return (
    <div className="json-tab" data-testid="json-tab">
      <div className="json-header">
        <div>
          <div className="json-title">Graph JSON</div>
          <div className="json-subtitle">Edit IR directly and apply.</div>
        </div>
        <div className="json-actions">
          <button className="button" onClick={onReset}>
            Sync from Graph
          </button>
          <button className="button primary" onClick={onApply} data-testid="apply-json">
            Apply JSON
          </button>
        </div>
      </div>
      <textarea
        className={`json-editor ${error ? "error" : ""}`}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        data-testid="json-editor"
        id="json-editor"
        name="json-editor"
      />
      {error && <div className="json-error">{error}</div>}
    </div>
  );
};
