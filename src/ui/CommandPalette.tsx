import { useEffect } from "react";
import "./CommandPalette.css";

export type CommandAction = {
  id: string;
  title: string;
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  query: string;
  actions: CommandAction[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
};

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
          placeholder="Search commands"
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
          {filtered.length === 0 && <div className="command-empty">No matches.</div>}
        </div>
      </div>
    </div>
  );
};
