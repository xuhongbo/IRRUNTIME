// 文件说明：自动补充文件级注释，描述模块职责与用途

jest.mock("../json", () => ({
  parseGraphJson: () => ({ ok: false, error: undefined }),
  stringifyGraph: (graph: unknown) => JSON.stringify(graph),
}));

import { createActor } from "xstate";
import { studioMachine } from "../machine";

describe("studioMachine apply JSON errors", () => {
  it("falls back to default error message", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "JSON_EDIT", draft: "{ bad" });
    actor.send({ type: "APPLY_JSON" });
    await Promise.resolve();
    const state = actor.getSnapshot();
    expect(state.context.jsonError).toBe("JSON 无效");
  });
});
