import { useMemo, useRef, useState } from "react";
import type { Graph, NodePosition } from "../engine/ir";
import type { Registry } from "../engine/registry";
import { createNodeInstance, listPaletteItems } from "../studio/nodeFactory";
import "./Palette.css";

type PaletteProps = {
  graph: Graph;
  registry: Registry;
  center: NodePosition;
  onAddNode: (node: Graph["nodes"][number]) => void;
};

export const Palette = ({ graph, registry, center, onAddNode }: PaletteProps) => {
  const [query, setQuery] = useState("");
  const addCounterRef = useRef(0);

  const items = useMemo(() => {
    const list = listPaletteItems(registry);
    const lower = query.trim().toLowerCase();
    if (!lower) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower)
    );
  }, [query, registry]);

  const handleAdd = (type: string, version: number) => {
    const offset = addCounterRef.current * 24;
    addCounterRef.current += 1;
    const pos = { x: center.x + offset, y: center.y + offset };
    const node = createNodeInstance(type, registry, pos, graph.nodes.length + addCounterRef.current);
    onAddNode(node);
  };

  return (
    <div className="palette" aria-label="Palette">
      <div className="palette-header">
        <div>
          <div className="palette-title">Palette</div>
          <div className="palette-subtitle">{items.length} node types</div>
        </div>
        <input
          className="palette-search"
          type="text"
          placeholder="Search nodes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="palette-list">
        {items.map((item) => (
          <button
            key={`${item.type}@${item.version}`}
            className="palette-item"
            onClick={() => handleAdd(item.type, item.version)}
            data-testid={`palette-${item.type}@${item.version}`}
          >
            <div className="palette-item-title">{item.title}</div>
            <div className="palette-item-meta">
              {item.type}@{item.version}
            </div>
            <div className="palette-item-desc">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
