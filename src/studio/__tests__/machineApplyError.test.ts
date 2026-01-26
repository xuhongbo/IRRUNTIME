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
    expect(state.context.jsonError).toBe("Invalid JSON");
  });
});
