// 文件说明：自动补充文件级注释，描述模块职责与用途

jest.mock("../validation", () => ({
  validateGraphWithRegistry: () => {
    throw new Error("boom");
  },
}));

import { createActor } from "xstate";
import { studioMachine } from "../machine";

describe("studioMachine validation errors", () => {
  it("records onError when validation throws", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "GRAPH_UPDATED", graph: actor.getSnapshot().context.graph });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const state = actor.getSnapshot();
    expect(state.context.validationStatus).toBe("invalid");
    expect(state.context.validationErrors[0]?.message).toContain("boom");
  });
});
