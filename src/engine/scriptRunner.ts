export type ScriptRunResult = {
  data: Record<string, unknown>;
  logs: string[];
};

const ensureSerializable = (value: unknown, seen = new Set<unknown>()) => {
  const valueType = typeof value;
  if (valueType === "function" || valueType === "symbol" || valueType === "undefined") {
    throw new Error("Output not serializable");
  }
  if (valueType === "bigint") {
    throw new Error("Output not serializable");
  }
  if (valueType !== "object" || value === null) {
    return;
  }
  if (seen.has(value)) {
    throw new Error("Output not serializable");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => ensureSerializable(item, seen));
    return;
  }
  Object.values(value as Record<string, unknown>).forEach((item) => ensureSerializable(item, seen));
};

const createSeededRandom = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const runScriptInWorker = ({
  code,
  inputs,
  context,
  timeoutMs,
  seed,
}: {
  code: string;
  inputs: Record<string, unknown>;
  context: Record<string, unknown>;
  timeoutMs: number;
  seed: number;
}): Promise<ScriptRunResult> => {
  if (typeof Worker === "undefined") {
    return Promise.resolve(runScriptInSandbox({ code, inputs, context, timeoutMs, seed }));
  }
  /* istanbul ignore next */
  const workerCode = `
    const createSeededRandom = (seed) => {
      let t = seed >>> 0;
      return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    };
    self.fetch = undefined;
    self.WebSocket = undefined;
    self.XMLHttpRequest = undefined;
    self.onmessage = (event) => {
      const { code, inputs, context, seed } = event.data;
      const logs = [];
      const rand = createSeededRandom(seed);
      const utils = {
        log: (...args) => {
          logs.push(args.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" "));
        },
        random: () => rand(),
        now: () => 0
      };
      let result;
      try {
        const fn = new Function("inputs", "context", "utils", "'use strict';\\n" + code);
        result = fn(inputs, context, utils);
      } catch (err) {
        self.postMessage({ ok: false, error: err && err.message ? err.message : String(err), logs });
        return;
      }
      try {
        const seen = new Set();
        const ensureSerializable = (value) => {
          const valueType = typeof value;
          if (valueType === "function" || valueType === "symbol" || valueType === "undefined") {
            throw new Error("Output not serializable");
          }
          if (valueType === "bigint") {
            throw new Error("Output not serializable");
          }
          if (valueType !== "object" || value === null) {
            return;
          }
          if (seen.has(value)) {
            throw new Error("Output not serializable");
          }
          seen.add(value);
          if (Array.isArray(value)) {
            value.forEach((item) => ensureSerializable(item));
            return;
          }
          Object.values(value).forEach((item) => ensureSerializable(item));
        };
        ensureSerializable(result);
      } catch (err) {
        self.postMessage({ ok: false, error: "Output not serializable", logs });
        return;
      }
      self.postMessage({ ok: true, result, logs });
    };
  `;

  /* istanbul ignore next */
  const blob = new Blob([workerCode], { type: "text/javascript" });
  /* istanbul ignore next */
  const worker = new Worker(URL.createObjectURL(blob));
  const timeout = Math.max(50, timeoutMs);

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Script timeout"));
    }, timeout);

    worker.onmessage = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (!event.data.ok) {
        reject(new Error(event.data.error || "Script error"));
        return;
      }
      resolve({
        data: typeof event.data.result === "object" && event.data.result !== null ? event.data.result : { value: event.data.result },
        logs: event.data.logs ?? [],
      });
    };

    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error("Script error"));
    };

    worker.postMessage({ code, inputs, context, seed });
  });
};

export const runScriptInSandbox = ({
  code,
  inputs,
  context,
  timeoutMs,
  seed,
}: {
  code: string;
  inputs: Record<string, unknown>;
  context: Record<string, unknown>;
  timeoutMs: number;
  seed: number;
}) => {
  const logs: string[] = [];
  const random = createSeededRandom(seed);
  const utils = {
    log: (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    },
    random: () => random(),
    now: () => 0,
  };
  const start = performance.now();
  const fn = new Function("inputs", "context", "utils", "'use strict';\n" + code);
  const result = fn(inputs, context, utils);
  if (performance.now() - start > timeoutMs) {
    throw new Error("Script timeout");
  }
  ensureSerializable(result);
  return {
    data: typeof result === "object" && result !== null ? result : { value: result },
    logs,
  };
};
