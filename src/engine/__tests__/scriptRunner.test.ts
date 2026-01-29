// 文件说明：自动补充文件级注释，描述模块职责与用途

import { runScriptInSandbox, runScriptInWorker } from "../scriptRunner";

describe("scriptRunner", () => {
  const originalWorker = global.Worker;
  const originalCreateObjectUrl = global.URL?.createObjectURL;

  class MockWorker {
    static nextMessage: unknown | null = null;
    static nextError = false;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = jest.fn();
    postMessage = () => {
      if (MockWorker.nextError) {
        this.onerror?.();
        return;
      }
      if (MockWorker.nextMessage) {
        this.onmessage?.({ data: MockWorker.nextMessage } as MessageEvent);
      }
    };
  }

  afterEach(() => {
    global.Worker = originalWorker;
    if (originalCreateObjectUrl) {
      global.URL.createObjectURL = originalCreateObjectUrl;
    }
    MockWorker.nextMessage = null;
    MockWorker.nextError = false;
    jest.useRealTimers();
  });

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

  it("uses deterministic Math.random and Date.now", () => {
    const result = runScriptInSandbox({
      code: "return { value: Math.random(), now: Date.now() };",
      inputs: {},
      context: {},
      timeoutMs: 500,
      seed: 1,
    });
    expect(result.data.value).toBeCloseTo(0.62707394, 6);
    expect(result.data.now).toBe(0);
  });

  it("captures console output", () => {
    const result = runScriptInSandbox({
      code: "console.log('a'); console.warn('b'); console.error('c'); return { ok: true };",
      inputs: {},
      context: {},
      timeoutMs: 500,
      seed: 1,
    });
    expect(result.logs).toEqual(["a", "b", "c"]);
  });

  it("limits log entries and size", () => {
    const result = runScriptInSandbox({
      code: "utils.log('a'.repeat(10)); utils.log('b'); utils.log('c'); return { ok: true };",
      inputs: {},
      context: {},
      timeoutMs: 500,
      seed: 1,
      maxLogEntries: 2,
      maxLogChars: 5,
    });
    expect(result.logs).toEqual(["aaaaa", "b"]);
  });

  it("rejects oversized output", () => {
    expect(() =>
      runScriptInSandbox({
        code: "return { text: 'x'.repeat(100) };",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
        maxOutputSize: 50,
      })
    ).toThrow("Output too large");
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

  it("rejects circular output", () => {
    expect(() =>
      runScriptInSandbox({
        code: "const obj = {}; obj.self = obj; return obj;",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
      })
    ).toThrow("Output not serializable");
  });

  it("accepts array output", () => {
    const result = runScriptInSandbox({
      code: "return [1, 2, 3];",
      inputs: {},
      context: {},
      timeoutMs: 500,
      seed: 1,
    });
    expect(Array.isArray(result.data)).toBe(true);
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

  it("rejects bigint output", () => {
    expect(() =>
      runScriptInSandbox({
        code: "return 1n;",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
      })
    ).toThrow("Output not serializable");
  });

  it("rejects undefined output", () => {
    expect(() =>
      runScriptInSandbox({
        code: "return { output: undefined };",
        inputs: {},
        context: {},
        timeoutMs: 500,
        seed: 1,
      })
    ).toThrow("Output not serializable");
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

  it("runs worker path success", async () => {
    global.Worker = MockWorker as unknown as typeof Worker;
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob://mock");
    MockWorker.nextMessage = { ok: true, result: { output: 9 }, logs: ["ok"] };
    const result = await runScriptInWorker({
      code: "return { output: inputs.input };",
      inputs: { input: 9 },
      context: {},
      timeoutMs: 500,
      seed: 2,
    });
    expect(result.data.output).toBe(9);
    expect(result.logs[0]).toBe("ok");
  });

  it("runs worker path primitive result", async () => {
    global.Worker = MockWorker as unknown as typeof Worker;
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob://mock");
    MockWorker.nextMessage = { ok: true, result: 7, logs: [] };
    const result = await runScriptInWorker({
      code: "return 7;",
      inputs: {},
      context: {},
      timeoutMs: 500,
      seed: 2,
    });
    expect(result.data.value).toBe(7);
  });

  it("runs worker path error", async () => {
    global.Worker = MockWorker as unknown as typeof Worker;
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob://mock");
    MockWorker.nextMessage = { ok: false, error: "bad" };
    await expect(
      runScriptInWorker({
        code: "return { output: inputs.input };",
        inputs: { input: 3 },
        context: {},
        timeoutMs: 500,
        seed: 2,
      })
    ).rejects.toThrow("bad");
  });

  it("runs worker path timeout", async () => {
    jest.useFakeTimers();
    global.Worker = MockWorker as unknown as typeof Worker;
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob://mock");
    const promise = runScriptInWorker({
      code: "return { output: inputs.input };",
      inputs: { input: 3 },
      context: {},
      timeoutMs: 10,
      seed: 2,
    });
    const assertion = expect(promise).rejects.toThrow("Script timeout");
    await jest.runAllTimersAsync();
    await assertion;
  });

  it("runs worker path onerror", async () => {
    global.Worker = MockWorker as unknown as typeof Worker;
    global.URL.createObjectURL = jest.fn().mockReturnValue("blob://mock");
    MockWorker.nextError = true;
    await expect(
      runScriptInWorker({
        code: "return { output: inputs.input };",
        inputs: { input: 3 },
        context: {},
        timeoutMs: 500,
        seed: 2,
      })
    ).rejects.toThrow("Script error");
  });
});
