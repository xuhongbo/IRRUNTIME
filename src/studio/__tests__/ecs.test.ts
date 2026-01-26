jest.mock("bitecs");
import { hasComponent } from "bitecs";
import type { Graph } from "../../engine/ir";
import { createEcsState, setSelection, setValidationState, syncGraphToEcs, Selected } from "../ecs";

const pos = { x: 0, y: 0 };

const makeGraph = (nodeIds: string[], entry = nodeIds[0]): Graph => ({
  id: "g",
  version: 1,
  entryNodeId: entry,
  nodes: nodeIds.map((id) => ({ id, type: "Start", version: 1, props: {}, pos })),
  edges: [],
});

describe("ecs", () => {
  it("creates entities and tracks selection", () => {
    const graph = makeGraph(["a", "b"], "a");
    const ecs = createEcsState(graph);
    expect(ecs.nodeEntities.size).toBe(2);
    expect(ecs.selectedNodeId).toBe("a");
  });

  it("syncs nodes and resets selection if missing", () => {
    const graph = makeGraph(["a", "b"], "a");
    const ecs = createEcsState(graph);
    setSelection(ecs, "b");
    const nextGraph = makeGraph(["a"], "a");
    syncGraphToEcs(ecs, nextGraph);
    expect(ecs.nodeEntities.has("b")).toBe(false);
    expect(ecs.selectedNodeId).toBe("a");
  });

  it("adds entities for new nodes on sync", () => {
    const graph = makeGraph(["a"], "a");
    const ecs = createEcsState(graph);
    const nextGraph = makeGraph(["a", "b"], "a");
    syncGraphToEcs(ecs, nextGraph);
    expect(ecs.nodeEntities.has("b")).toBe(true);
  });

  it("updates selection component flags", () => {
    const graph = makeGraph(["a", "b"], "a");
    const ecs = createEcsState(graph);
    setSelection(ecs, "b");
    const aEid = ecs.nodeEntities.get("a");
    const bEid = ecs.nodeEntities.get("b");
    expect(aEid).toBeDefined();
    expect(bEid).toBeDefined();
    if (aEid !== undefined && bEid !== undefined) {
      expect(hasComponent(ecs.world, aEid, Selected)).toBe(false);
      expect(hasComponent(ecs.world, bEid, Selected)).toBe(true);
    }
  });

  it("stores validation state", () => {
    const graph = makeGraph(["a"], "a");
    const ecs = createEcsState(graph);
    setValidationState(ecs, "invalid", [{ message: "bad", nodeId: "a" }]);
    expect(ecs.validationStatus).toBe("invalid");
    expect(ecs.validationErrors.length).toBe(1);
  });
});
