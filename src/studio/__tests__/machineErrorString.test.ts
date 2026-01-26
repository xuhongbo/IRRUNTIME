jest.mock("../validation", () => ({
  validateGraphWithRegistry: () => {
    throw "bad";
  },
}));

import { createActor } from "xstate";
import { studioMachine } from "../machine";

describe("studioMachine validation error fallback", () => {
  it("uses fallback message for non-Error throws", async () => {
    const actor = createActor(studioMachine).start();
    actor.send({ type: "GRAPH_UPDATED", graph: actor.getSnapshot().context.graph });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const state = actor.getSnapshot();
    expect(state.context.validationErrors[0]?.message).toBe("Validation failed.");
  });
});
