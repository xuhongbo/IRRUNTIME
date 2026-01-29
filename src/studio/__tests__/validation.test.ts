// 文件说明：自动补充文件级注释，描述模块职责与用途

import { validateGraphWithRegistry } from "../validation";
import { sampleGraph } from "../../mock/graph";
import { registry } from "../../engine/registry";

describe("validateGraphWithRegistry", () => {
  it("validates sample graph", () => {
    const migrated = registry.migrateGraph(sampleGraph).graph;
    const result = validateGraphWithRegistry(migrated);
    expect(result.ok).toBe(true);
  });
});
