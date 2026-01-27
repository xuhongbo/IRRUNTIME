import { runScriptInSandbox, runScriptInWorker } from "../scriptRunner";

describe("scriptRunner", () => {
  it("executes code and captures logs", () => {
    const result = runScriptInSandbox({
      code: "utils.log('hi'); return { output: inputs.input };",
      inputs: { input: 42 },
      context: {},
      timeoutMs: 500,
      seed: 1,
    });
    expect(result.data.output).toBe(42);
    expect(result.logs[0]).toContain("hi");
  });

  it("rejects non-serializable output", () => {
    expect(() =>
      runScriptInSandbox({
        code: "return { output: () => {} };",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
      })
    ).toThrow();
  });

  it("throws on script error", () => {
    expect(() =>
      runScriptInSandbox({
        code: "throw new Error('boom');",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
      })
    ).toThrow("boom");
  });

  it("throws on timeout", () => {
    const spy = jest
      .spyOn(performance, "now")
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 1000);
    expect(() =>
      runScriptInSandbox({
        code: "return { output: 1 };",
        inputs: {},
        context: {},
        timeoutMs: 10,
        seed: 1,
      })
    ).toThrow("Script timeout");
    spy.mockRestore();
  });

  it("runs worker fallback", async () => {
    const result = await runScriptInWorker({
      code: "return { output: inputs.input };",
      inputs: { input: 5 },
      context: {},
      timeoutMs: 500,
      seed: 2,
    });
    expect(result.data.output).toBe(5);
  });
});
