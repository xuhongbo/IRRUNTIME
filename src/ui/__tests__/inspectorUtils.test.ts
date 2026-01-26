import type { Graph } from "../../engine/ir";
import { registry } from "../../engine/registry";
import { getNodePinStatus, groupNodeErrors } from "../inspectorUtils";

const baseGraph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "start",
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    { id: "const-text", type: "ConstString", version: 1, props: { value: "Hi" }, pos: { x: 200, y: 0 } },
    { id: "show", type: "ShowText", version: 2, props: { title: "Hello" }, pos: { x: 400, y: 0 } },
  ],
  edges: [
    { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const-text", pinKey: "in" } },
    { id: "e2", from: { nodeId: "const-text", pinKey: "out" }, to: { nodeId: "show", pinKey: "in" } },
    { id: "d1", from: { nodeId: "const-text", pinKey: "value" }, to: { nodeId: "show", pinKey: "text" } },
  ],
};

describe("inspectorUtils", () => {
  it("groups node and pin errors", () => {
    const errors = [
      { nodeId: "show", message: "Node error" },
      { nodeId: "show", pinKey: "text", message: "Pin error" },
      { nodeId: "start", message: "Other node" },
    ];
    const grouped = groupNodeErrors(errors, "show");
    expect(grouped.nodeErrors).toHaveLength(1);
    expect(grouped.nodeErrors[0].message).toBe("Node error");
    expect(grouped.pinErrors.get("text")).toEqual(["Pin error"]);
  });

  it("builds pin status with connection counts and errors", () => {
    const errors = [
      { nodeId: "show", pinKey: "text", message: "Missing text" },
      { nodeId: "show", pinKey: "in", message: "Missing exec" },
    ];
    const grouped = groupNodeErrors(errors, "show");
    const status = getNodePinStatus(baseGraph, "show", registry, grouped.pinErrors);
    expect(status).not.toBeNull();
    if (!status) return;
    const inputText = status.inputs.find((pin) => pin.key === "text");
    expect(inputText?.connected).toBe(true);
    expect(inputText?.connections).toBe(1);
    expect(inputText?.errors).toEqual(["Missing text"]);
    const inputExec = status.inputs.find((pin) => pin.key === "in");
    expect(inputExec?.errors).toEqual(["Missing exec"]);
    const outputOut = status.outputs.find((pin) => pin.key === "out");
    expect(outputOut?.connected).toBe(false);
  });
});
