// 文件说明：自动补充文件级注释，描述模块职责与用途

import { formatTraceJson } from "../traceUtils";

describe("formatTraceJson", () => {
  it("serializes trace entries", () => {
    const runMeta = {
      runId: 1,
      graphId: "g",
      graphVersion: 1,
      nodeVersions: {},
      inputsSnapshot: {},
      choices: [],
      seed: 0,
    };
    const text = formatTraceJson(runMeta, [
      { runId: 1, seq: 0, nodeId: "a", type: "Start", startMs: 0, endMs: 1, durationMs: 1, inputs: {}, outputs: {} },
    ]);
    expect(text).toContain("\"nodeId\": \"a\"");
    expect(text).toContain("\"graphId\": \"g\"");
  });
});
