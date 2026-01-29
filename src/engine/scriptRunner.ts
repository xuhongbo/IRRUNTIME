// 文件说明：自动补充文件级注释，描述模块职责与用途

// 脚本执行结果：包含输出数据与日志
export type ScriptRunResult = {
  data: Record<string, unknown>;
  logs: string[];
};

// 脚本预算：限制执行资源与输出大小
export type ScriptBudget = {
  timeoutMs: number;
  maxOutputSize: number;
  maxLogEntries: number;
  maxLogChars: number;
};

// 默认脚本预算
const defaultBudget: ScriptBudget = {
  timeoutMs: 500,
  maxOutputSize: 20000,
  maxLogEntries: 50,
  maxLogChars: 500,
};

// 构建日志收集器，控制日志条数与长度
const createLogCollector = (budget: ScriptBudget) => {
  const logs: string[] = [];
  const push = (value: string) => {
    if (logs.length >= budget.maxLogEntries) {
      return;
    }
    const trimmed = value.length > budget.maxLogChars ? value.slice(0, budget.maxLogChars) : value;
    logs.push(trimmed);
  };
  return { logs, push };
};

// 校验输出是否可序列化，避免循环引用与不可序列化类型
const ensureSerializable = (value: unknown, seen = new Set<unknown>()) => {
  const valueType = typeof value;
  if (valueType === "function" || valueType === "symbol" || valueType === "undefined") {
    throw new Error("输出结果无法序列化");
  }
  if (valueType === "bigint") {
    throw new Error("输出结果无法序列化");
  }
  if (valueType !== "object" || value === null) {
    return;
  }
  if (seen.has(value)) {
    throw new Error("输出结果无法序列化");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => ensureSerializable(item, seen));
    return;
  }
  Object.values(value as Record<string, unknown>).forEach((item) => ensureSerializable(item, seen));
};

// 生成可复现的随机数函数
const createSeededRandom = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

// 创建安全的 Math，替换随机数实现
const createSafeMath = (rand: () => number) => {
  const safe = Object.create(Math) as typeof Math;
  safe.random = () => rand();
  return safe;
};

// 创建安全的 Date，屏蔽真实时间
const createSafeDate = () => {
  return class SafeDate extends Date {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(0);
      } else {
        super(...args);
      }
    }
    static now() {
      return 0;
    }
  };
};

// 安全 console：记录日志但不允许外部副作用
const createSafeConsole = (logs: string[]) => ({
  log: (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  },
  warn: (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  },
  error: (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  },
});

// 在 Worker 中执行脚本（不可用时降级为沙箱执行）
export const runScriptInWorker = ({
  code,
  inputs,
  context,
  timeoutMs = defaultBudget.timeoutMs,
  seed,
  maxOutputSize = defaultBudget.maxOutputSize,
  maxLogEntries = defaultBudget.maxLogEntries,
  maxLogChars = defaultBudget.maxLogChars,
}: {
  code: string;
  inputs: Record<string, unknown>;
  context: Record<string, unknown>;
  timeoutMs?: number;
  seed: number;
  maxOutputSize?: number;
  maxLogEntries?: number;
  maxLogChars?: number;
}): Promise<ScriptRunResult> => {
  // 无 Worker 时直接在沙箱中执行
  if (typeof Worker === "undefined") {
    return Promise.resolve(
      runScriptInSandbox({
        code,
        inputs,
        context,
        timeoutMs,
        seed,
        maxOutputSize,
        maxLogEntries,
        maxLogChars,
      })
    );
  }
  /* istanbul ignore next */
  // Worker 内执行代码：隔离环境并限制 API
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
    const createSafeMath = (rand) => {
      const safe = Object.create(Math);
      safe.random = () => rand();
      return safe;
    };
    const createSafeDate = () => {
      return class SafeDate extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(0);
          } else {
            super(...args);
          }
        }
        static now() {
          return 0;
        }
      };
    };
    const createSafeConsole = (logs) => ({
      log: (...args) => logs.push(args.map((item) => String(item)).join(" ")),
      warn: (...args) => logs.push(args.map((item) => String(item)).join(" ")),
      error: (...args) => logs.push(args.map((item) => String(item)).join(" "))
    });
    self.fetch = undefined;
    self.WebSocket = undefined;
    self.XMLHttpRequest = undefined;
    self.onmessage = (event) => {
      const { code, inputs, context, seed, budget } = event.data;
      const logs = [];
      const rand = createSeededRandom(seed);
      const safeMath = createSafeMath(rand);
      const SafeDate = createSafeDate();
      const safeConsole = createSafeConsole(logs);
      const pushLog = (value) => {
        if (logs.length >= budget.maxLogEntries) return;
        logs.push(String(value).slice(0, budget.maxLogChars));
      };
      const utils = {
        log: (...args) => {
          pushLog(args.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" "));
        },
        random: () => rand(),
        now: () => 0
      };
      let result;
      try {
        const fn = new Function(
          "inputs",
          "context",
          "utils",
          "Math",
          "Date",
          "console",
          "fetch",
          "WebSocket",
          "XMLHttpRequest",
          "'use strict';\\n" + code
        );
        result = fn(inputs, context, utils, safeMath, SafeDate, safeConsole, undefined, undefined, undefined);
      } catch (err) {
        self.postMessage({ ok: false, error: err && err.message ? err.message : String(err), logs });
        return;
      }
      try {
        const seen = new Set();
        const ensureSerializable = (value) => {
          const valueType = typeof value;
          if (valueType === "function" || valueType === "symbol" || valueType === "undefined") {
            throw new Error("输出结果无法序列化");
          }
          if (valueType === "bigint") {
            throw new Error("输出结果无法序列化");
          }
          if (valueType !== "object" || value === null) {
            return;
          }
          if (seen.has(value)) {
            throw new Error("输出结果无法序列化");
          }
          seen.add(value);
          if (Array.isArray(value)) {
            value.forEach((item) => ensureSerializable(item));
            return;
          }
          Object.values(value).forEach((item) => ensureSerializable(item));
        };
        ensureSerializable(result);
        const outputJson = JSON.stringify(result);
        if (outputJson && outputJson.length > budget.maxOutputSize) {
          throw new Error("输出过大");
        }
      } catch (err) {
        self.postMessage({ ok: false, error: "输出结果无法序列化", logs });
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
      reject(new Error("脚本执行超时"));
    }, timeout);

    worker.onmessage = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (!event.data.ok) {
        reject(new Error(event.data.error || "脚本执行错误"));
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
      reject(new Error("脚本执行错误"));
    };

    worker.postMessage({
      code,
      inputs,
      context,
      seed,
      budget: { maxOutputSize, maxLogEntries, maxLogChars },
    });
  });
};

// 在当前线程沙箱执行脚本
export const runScriptInSandbox = ({
  code,
  inputs,
  context,
  timeoutMs = defaultBudget.timeoutMs,
  seed,
  maxOutputSize = defaultBudget.maxOutputSize,
  maxLogEntries = defaultBudget.maxLogEntries,
  maxLogChars = defaultBudget.maxLogChars,
}: {
  code: string;
  inputs: Record<string, unknown>;
  context: Record<string, unknown>;
  timeoutMs?: number;
  seed: number;
  maxOutputSize?: number;
  maxLogEntries?: number;
  maxLogChars?: number;
}) => {
  const budget: ScriptBudget = {
    timeoutMs,
    maxOutputSize,
    maxLogEntries,
    maxLogChars,
  };
  const { logs, push } = createLogCollector(budget);
  const random = createSeededRandom(seed);
  const safeMath = createSafeMath(random);
  const SafeDate = createSafeDate();
  const utils = {
    log: (...args: unknown[]) => {
      push(args.map((item) => String(item)).join(" "));
    },
    random: () => random(),
    now: () => 0,
  };
  const safeConsole = {
    log: (...args: unknown[]) => push(args.map((item) => String(item)).join(" ")),
    warn: (...args: unknown[]) => push(args.map((item) => String(item)).join(" ")),
    error: (...args: unknown[]) => push(args.map((item) => String(item)).join(" ")),
  };
  const start = performance.now();
  const fn = new Function(
    "inputs",
    "context",
    "utils",
    "Math",
    "Date",
    "console",
    "fetch",
    "WebSocket",
    "XMLHttpRequest",
    "'use strict';\n" + code
  );
  const result = fn(inputs, context, utils, safeMath, SafeDate, safeConsole, undefined, undefined, undefined);
  if (performance.now() - start > timeoutMs) {
    throw new Error("脚本执行超时");
  }
  ensureSerializable(result);
  const outputJson = JSON.stringify(result);
  if (outputJson && outputJson.length > budget.maxOutputSize) {
    throw new Error("输出过大");
  }
  return {
    data: typeof result === "object" && result !== null ? result : { value: result },
    logs,
  };
};
