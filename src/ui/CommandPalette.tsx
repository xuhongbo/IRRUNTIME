// 文件说明：自动补充文件级注释，描述模块职责与用途

// 命令面板：提供快捷命令检索与执行
import { useEffect } from "react";
import "./CommandPalette.css";

// 命令定义
export type CommandAction = {
  id: string;
  title: string;
  keywords?: string;
  run: () => void;
};

// 命令面板参数
type CommandPaletteProps = {
  open: boolean;
  query: string;
  actions: CommandAction[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
};

// 命令面板组件
export const CommandPalette = ({ open, query, actions, onQueryChange, onClose }: CommandPaletteProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const q = query.trim().toLowerCase();
  const filtered = actions.filter((action) => {
    if (!q) return true;
    return (
      action.title.toLowerCase().includes(q) ||
      action.keywords?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="command-palette-backdrop" role="dialog" aria-modal="true">
      <div className="command-palette">
        <input
          autoFocus
          placeholder="搜索命令"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="command-list">
          {filtered.map((action) => (
            <button
              key={action.id}
              className="command-item"
              onClick={() => {
                action.run();
                onClose();
              }}
            >
              {action.title}
            </button>
          ))}
          {filtered.length === 0 && <div className="command-empty">无匹配命令。</div>}
        </div>
      </div>
    </div>
  );
};
