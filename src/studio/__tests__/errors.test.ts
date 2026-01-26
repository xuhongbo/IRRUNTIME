import { buildErrorMap } from "../errors";

describe("buildErrorMap", () => {
  it("groups node and pin errors by node id", () => {
    const errors = [
      { nodeId: "a", message: "Node error" },
      { nodeId: "a", pinKey: "in", message: "Pin error" },
      { nodeId: "b", pinKey: "x", message: "Other pin" },
    ];
    const map = buildErrorMap(errors);
    const a = map.get("a");
    expect(a?.nodeErrors).toEqual(["Node error"]);
    expect(a?.pinErrors.in).toEqual(["Pin error"]);
    const b = map.get("b");
    expect(b?.pinErrors.x).toEqual(["Other pin"]);
  });
});
