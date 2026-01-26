import { registry } from "../../engine/registry";
import { createNodeInstance, listPaletteItems, makeNodeId } from "../nodeFactory";

describe("nodeFactory", () => {
  it("creates deterministic ids", () => {
    expect(makeNodeId("ShowText", 123)).toBe("showtext-123");
  });

  it("creates node instances from registry defaults", () => {
    const node = createNodeInstance("ConstString", registry, { x: 10, y: 20 }, 7);
    expect(node.id).toBe("conststring-7");
    expect(node.type).toBe("ConstString");
    expect(node.version).toBe(1);
    expect(node.props).toEqual({ value: "" });
    expect(node.pos).toEqual({ x: 10, y: 20 });
  });

  it("throws on unknown node types", () => {
    expect(() => createNodeInstance("Missing", registry, { x: 0, y: 0 }, 1)).toThrow("Unknown node type");
  });

  it("lists palette items", () => {
    const items = listPaletteItems(registry);
    const types = items.map((item) => item.type);
    expect(types).toContain("Start");
    expect(types).toContain("ShowText");
  });
});
