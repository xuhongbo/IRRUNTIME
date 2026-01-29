// 文件说明：自动补充文件级注释，描述模块职责与用途

import { buildErrorMap } from "../errors";

describe("buildErrorMap", () => {
  it("groups node and pin errors by node id", () => {
    const errors = [
      { nodeId: "a", message: "Node error" },
      { nodeId: "a", pinId: "in", message: "Pin error" },
      { nodeId: "b", pinId: "x", message: "Other pin" },
    ];
    const map = buildErrorMap(errors);
    const a = map.get("a");
    expect(a?.nodeErrors).toEqual(["Node error"]);
    expect(a?.pinErrors.in).toEqual(["Pin error"]);
    const b = map.get("b");
    expect(b?.pinErrors.x).toEqual(["Other pin"]);
  });
});
