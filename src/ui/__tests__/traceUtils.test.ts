import { formatTraceJson } from "../traceUtils";

describe("formatTraceJson", () => {
  it("serializes trace entries", () => {
    const text = formatTraceJson([{ runId: 1, seq: 0, nodeId: "a", type: "Start", startMs: 0, endMs: 1, durationMs: 1, inputs: {}, outputs: {} }]);
    expect(text).toContain("\"nodeId\": \"a\"");
  });
});
