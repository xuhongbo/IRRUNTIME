import type { ViewModel } from "../engine/viewModel";
import "./Runner.css";

type RunnerProps = {
  viewModel: ViewModel | null;
  status: string;
  outputs?: Record<string, unknown>;
  onNext: () => void;
  onChoose: (choiceKey: string) => void;
};

export const Runner = ({ viewModel, status, outputs, onNext, onChoose }: RunnerProps) => {
  if (!viewModel) {
    return (
      <div className="runner empty" data-testid="runner-root">
        <div className="runner-title">Runner</div>
        <div className="runner-body">No active view model. Status: {status}</div>
        {outputs && Object.keys(outputs).length > 0 && (
          <div className="runner-outputs">
            <div className="runner-outputs-title">Outputs</div>
            <pre>{JSON.stringify(outputs, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="runner" data-testid="runner-root">
      <div className="runner-title">{viewModel.title}</div>
      <div className="runner-body">{viewModel.body}</div>
      {viewModel.kind === "choice" && (
        <div className="runner-actions">
          {viewModel.choices.map((choice) => (
            <button key={choice.key} className="button primary" onClick={() => onChoose(choice.key)}>
              {choice.label}
            </button>
          ))}
        </div>
      )}
      {viewModel.kind === "text" && (
        <div className="runner-actions">
          <button className="button primary" onClick={onNext}>
            Next
          </button>
        </div>
      )}
      {viewModel.kind === "waiting" && <div className="runner-hint">Waiting for async completion...</div>}
      {viewModel.kind === "error" && <div className="runner-hint error">Execution halted.</div>}
      {viewModel.kind === "done" && <div className="runner-hint">Workflow completed.</div>}
      {outputs && Object.keys(outputs).length > 0 && (
        <div className="runner-outputs">
          <div className="runner-outputs-title">Outputs</div>
          <pre>{JSON.stringify(outputs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
