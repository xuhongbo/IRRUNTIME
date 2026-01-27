import type { ViewModel } from "../engine/viewModel";
import "./Runner.css";

type RunnerProps = {
  viewModel: ViewModel | null;
  status: string;
  outputs?: Record<string, unknown>;
  presets?: { id: string; title: string }[];
  selectedPresetId?: string | null;
  onSelectPreset?: (presetId: string) => void;
  onNext: () => void;
  onChoose: (choiceKey: string) => void;
};

export const Runner = ({
  viewModel,
  status,
  outputs,
  presets,
  selectedPresetId,
  onSelectPreset,
  onNext,
  onChoose,
}: RunnerProps) => {
  if (!viewModel) {
    return (
      <div className="runner empty" data-testid="runner-root">
        <div className="runner-title">运行面板</div>
        <div className="runner-body">暂无运行视图。状态：{status}</div>
        {presets && presets.length > 0 && (
          <div className="runner-presets">
            <label>
              预设
              <select
                value={selectedPresetId ?? presets[0]?.id}
                onChange={(event) => onSelectPreset?.(event.target.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {outputs && Object.keys(outputs).length > 0 && (
          <div className="runner-outputs">
            <div className="runner-outputs-title">输出</div>
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
            <button
              key={choice.key}
              className="button primary"
              onClick={() => onChoose(choice.key)}
              data-testid={`runner-choice-${choice.key}`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
      {viewModel.kind === "text" && (
        <div className="runner-actions">
          <button className="button primary" onClick={onNext} data-testid="runner-next">
            下一步
          </button>
        </div>
      )}
      {viewModel.kind === "waiting" && <div className="runner-hint">等待异步完成...</div>}
      {viewModel.kind === "error" && <div className="runner-hint error">执行已中止。</div>}
      {viewModel.kind === "done" && <div className="runner-hint">流程已完成。</div>}
      {presets && presets.length > 0 && (
        <div className="runner-presets">
          <label>
            预设
            <select
              value={selectedPresetId ?? presets[0]?.id}
              onChange={(event) => onSelectPreset?.(event.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {outputs && Object.keys(outputs).length > 0 && (
        <div className="runner-outputs">
          <div className="runner-outputs-title">输出</div>
          <pre>{JSON.stringify(outputs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
