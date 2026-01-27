import type { Graph } from "./ir";

export const sampleGraph: Graph = {
  id: "main",
  version: 1,
  entryNodeId: "start",
  contract: {
    inputs: [
      { name: "userName", type: "string", required: true, defaultValue: "Alex", description: "用户名称" },
      { name: "baseValue", type: "number", required: true, defaultValue: 10, description: "基准数值" },
      { name: "scale", type: "number", required: true, defaultValue: 2, description: "缩放系数" },
    ],
    outputs: [
      { name: "greeting", type: "string", required: true, description: "问候语" },
      { name: "computed", type: "number", required: true, description: "计算结果" },
      { name: "status", type: "string", required: true, description: "运行状态" },
    ],
  },
  presets: [
    {
      id: "default",
      title: "默认",
      description: "默认运行输入。",
      inputs: { userName: "Alex", baseValue: 10, scale: 2 },
    },
    {
      id: "negative",
      title: "负值示例",
      description: "触发异常分支。",
      inputs: { userName: "Casey", baseValue: -5, scale: 2 },
    },
    {
      id: "zero-scale",
      title: "零倍率",
      description: "触发脚本运行错误。",
      inputs: { userName: "Sam", baseValue: 4, scale: 0 },
    },
  ],
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },

    { id: "const-name-user", type: "ConstString", version: 1, props: { value: "userName" }, pos: { x: 120, y: -120 } },
    { id: "graph-input-user", type: "GraphInput", version: 1, props: { name: "userName" }, pos: { x: 120, y: 40 } },
    { id: "set-user", type: "SetVar", version: 1, props: {}, pos: { x: 240, y: 0 } },

    { id: "const-name-base", type: "ConstString", version: 1, props: { value: "baseValue" }, pos: { x: 120, y: 160 } },
    { id: "graph-input-base", type: "GraphInput", version: 1, props: { name: "baseValue" }, pos: { x: 120, y: 320 } },
    { id: "set-base", type: "SetVar", version: 1, props: {}, pos: { x: 480, y: 0 } },

    { id: "const-name-scale", type: "ConstString", version: 1, props: { value: "scale" }, pos: { x: 120, y: 440 } },
    { id: "graph-input-scale", type: "GraphInput", version: 1, props: { name: "scale" }, pos: { x: 120, y: 600 } },
    { id: "set-scale", type: "SetVar", version: 1, props: {}, pos: { x: 720, y: 0 } },

    {
      id: "script-compute",
      type: "Script",
      version: 1,
      props: {
        code:
          "const name = String(context.vars.userName ?? \"Guest\");\\n" +
          "const base = Number(context.vars.baseValue ?? 0);\\n" +
          "const scale = Number(context.vars.scale ?? 1);\\n" +
          "if (scale === 0) throw new Error(\"Scale cannot be zero\");\\n" +
          "const computed = base * scale;\\n" +
          "const greeting = `Hello ${name}`;\\n" +
          "const status = computed >= 0 ? \"ok\" : \"error\";\\n" +
          "return { greeting, computed, status };",
        timeoutMs: 500,
      },
      pos: { x: 960, y: 0 },
    },
    {
      id: "script-extract-status",
      type: "Script",
      version: 1,
      props: {
        code:
          "const data = inputs.input && typeof inputs.input === \"object\" ? inputs.input : {};\\n" +
          "return { output: String(data.status ?? \"error\") };",
      },
      pos: { x: 1200, y: 0 },
    },
    { id: "to-string-status", type: "ToString", version: 1, props: {}, pos: { x: 1320, y: 0 } },
    { id: "const-ok", type: "ConstString", version: 1, props: { value: "ok" }, pos: { x: 1200, y: -140 } },
    { id: "equals-status", type: "Equals", version: 1, props: {}, pos: { x: 1440, y: 0 } },
    { id: "if-status", type: "If", version: 1, props: {}, pos: { x: 1680, y: 0 } },

    {
      id: "script-extract-greeting",
      type: "Script",
      version: 1,
      props: {
        code:
          "const data = inputs.input && typeof inputs.input === \"object\" ? inputs.input : {};\\n" +
          "return { output: String(data.greeting ?? \"\") };",
      },
      pos: { x: 1920, y: -160 },
    },
    { id: "to-string-greeting", type: "ToString", version: 1, props: {}, pos: { x: 2040, y: -160 } },
    {
      id: "script-extract-computed",
      type: "Script",
      version: 1,
      props: {
        code:
          "const data = inputs.input && typeof inputs.input === \"object\" ? inputs.input : {};\\n" +
          "return { output: Number(data.computed ?? 0) };",
      },
      pos: { x: 2160, y: -160 },
    },
    { id: "to-number-computed", type: "ToNumber", version: 1, props: {}, pos: { x: 2280, y: -160 } },
    { id: "const-delay", type: "ConstNumber", version: 1, props: { value: 800 }, pos: { x: 2400, y: -160 } },
    { id: "delay", type: "Delay", version: 1, props: {}, pos: { x: 2640, y: -160 } },
    { id: "output-greeting", type: "GraphOutput", version: 1, props: { name: "greeting" }, pos: { x: 2880, y: -160 } },
    { id: "output-computed", type: "GraphOutput", version: 1, props: { name: "computed" }, pos: { x: 3120, y: -160 } },
    { id: "output-status-ok", type: "GraphOutput", version: 1, props: { name: "status" }, pos: { x: 3360, y: -160 } },
    { id: "end-success", type: "End", version: 1, props: {}, pos: { x: 3600, y: -160 } },

    { id: "const-error-text", type: "ConstString", version: 1, props: { value: "Status not ok. Please check inputs." }, pos: { x: 1920, y: 160 } },
    { id: "show-error", type: "ShowText", version: 2, props: { title: "Error Branch" }, pos: { x: 2160, y: 160 } },
    { id: "output-status-error", type: "GraphOutput", version: 1, props: { name: "status" }, pos: { x: 2400, y: 160 } },
    { id: "end-error", type: "End", version: 1, props: {}, pos: { x: 2640, y: 160 } },

    { id: "const-runtime-status", type: "ConstString", version: 1, props: { value: "runtime_error" }, pos: { x: 1920, y: 320 } },
    { id: "output-status-runtime", type: "GraphOutput", version: 1, props: { name: "status" }, pos: { x: 2160, y: 320 } },
    { id: "end-runtime-error", type: "End", version: 1, props: {}, pos: { x: 2400, y: 320 } },
  ],
  edges: [
    { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "const-name-user", pinKey: "in" } },
    { id: "e2", from: { nodeId: "const-name-user", pinKey: "out" }, to: { nodeId: "set-user", pinKey: "in" } },
    { id: "e3", from: { nodeId: "set-user", pinKey: "out" }, to: { nodeId: "const-name-base", pinKey: "in" } },
    { id: "e4", from: { nodeId: "const-name-base", pinKey: "out" }, to: { nodeId: "set-base", pinKey: "in" } },
    { id: "e5", from: { nodeId: "set-base", pinKey: "out" }, to: { nodeId: "const-name-scale", pinKey: "in" } },
    { id: "e6", from: { nodeId: "const-name-scale", pinKey: "out" }, to: { nodeId: "set-scale", pinKey: "in" } },
    { id: "e7", from: { nodeId: "set-scale", pinKey: "out" }, to: { nodeId: "script-compute", pinKey: "in" } },
    { id: "e8", from: { nodeId: "script-compute", pinKey: "out" }, to: { nodeId: "script-extract-status", pinKey: "in" } },
    { id: "e9", from: { nodeId: "script-extract-status", pinKey: "out" }, to: { nodeId: "to-string-status", pinKey: "in" } },
    { id: "e10", from: { nodeId: "to-string-status", pinKey: "out" }, to: { nodeId: "const-ok", pinKey: "in" } },
    { id: "e11", from: { nodeId: "const-ok", pinKey: "out" }, to: { nodeId: "equals-status", pinKey: "in" } },
    { id: "e12", from: { nodeId: "equals-status", pinKey: "out" }, to: { nodeId: "if-status", pinKey: "in" } },

    { id: "e13", from: { nodeId: "if-status", pinKey: "then" }, to: { nodeId: "script-extract-greeting", pinKey: "in" } },
    { id: "e14", from: { nodeId: "script-extract-greeting", pinKey: "out" }, to: { nodeId: "to-string-greeting", pinKey: "in" } },
    { id: "e15", from: { nodeId: "to-string-greeting", pinKey: "out" }, to: { nodeId: "script-extract-computed", pinKey: "in" } },
    { id: "e16", from: { nodeId: "script-extract-computed", pinKey: "out" }, to: { nodeId: "to-number-computed", pinKey: "in" } },
    { id: "e17", from: { nodeId: "to-number-computed", pinKey: "out" }, to: { nodeId: "const-delay", pinKey: "in" } },
    { id: "e18", from: { nodeId: "const-delay", pinKey: "out" }, to: { nodeId: "delay", pinKey: "in" } },
    { id: "e19", from: { nodeId: "delay", pinKey: "out" }, to: { nodeId: "output-greeting", pinKey: "in" } },
    { id: "e20", from: { nodeId: "output-greeting", pinKey: "out" }, to: { nodeId: "output-computed", pinKey: "in" } },
    { id: "e21", from: { nodeId: "output-computed", pinKey: "out" }, to: { nodeId: "output-status-ok", pinKey: "in" } },
    { id: "e22", from: { nodeId: "output-status-ok", pinKey: "out" }, to: { nodeId: "end-success", pinKey: "in" } },

    { id: "e23", from: { nodeId: "if-status", pinKey: "else" }, to: { nodeId: "const-error-text", pinKey: "in" } },
    { id: "e24", from: { nodeId: "const-error-text", pinKey: "out" }, to: { nodeId: "show-error", pinKey: "in" } },
    { id: "e25", from: { nodeId: "show-error", pinKey: "out" }, to: { nodeId: "output-status-error", pinKey: "in" } },
    { id: "e26", from: { nodeId: "output-status-error", pinKey: "out" }, to: { nodeId: "end-error", pinKey: "in" } },

    { id: "e27", from: { nodeId: "script-compute", pinKey: "onError" }, to: { nodeId: "const-runtime-status", pinKey: "in" } },
    { id: "e28", from: { nodeId: "const-runtime-status", pinKey: "out" }, to: { nodeId: "output-status-runtime", pinKey: "in" } },
    { id: "e29", from: { nodeId: "output-status-runtime", pinKey: "out" }, to: { nodeId: "end-runtime-error", pinKey: "in" } },

    { id: "d1", from: { nodeId: "const-name-user", pinKey: "value" }, to: { nodeId: "set-user", pinKey: "name" } },
    { id: "d2", from: { nodeId: "graph-input-user", pinKey: "value" }, to: { nodeId: "set-user", pinKey: "value" } },
    { id: "d3", from: { nodeId: "const-name-base", pinKey: "value" }, to: { nodeId: "set-base", pinKey: "name" } },
    { id: "d4", from: { nodeId: "graph-input-base", pinKey: "value" }, to: { nodeId: "set-base", pinKey: "value" } },
    { id: "d5", from: { nodeId: "const-name-scale", pinKey: "value" }, to: { nodeId: "set-scale", pinKey: "name" } },
    { id: "d6", from: { nodeId: "graph-input-scale", pinKey: "value" }, to: { nodeId: "set-scale", pinKey: "value" } },

    { id: "d7", from: { nodeId: "script-compute", pinKey: "output" }, to: { nodeId: "script-extract-status", pinKey: "input" } },
    { id: "d8", from: { nodeId: "script-compute", pinKey: "output" }, to: { nodeId: "script-extract-greeting", pinKey: "input" } },
    { id: "d9", from: { nodeId: "script-compute", pinKey: "output" }, to: { nodeId: "script-extract-computed", pinKey: "input" } },
    { id: "d10", from: { nodeId: "script-extract-status", pinKey: "output" }, to: { nodeId: "to-string-status", pinKey: "value" } },
    { id: "d11", from: { nodeId: "to-string-status", pinKey: "text" }, to: { nodeId: "equals-status", pinKey: "a" } },
    { id: "d12", from: { nodeId: "const-ok", pinKey: "value" }, to: { nodeId: "equals-status", pinKey: "b" } },
    { id: "d13", from: { nodeId: "equals-status", pinKey: "isEqual" }, to: { nodeId: "if-status", pinKey: "condition" } },
    { id: "d14", from: { nodeId: "script-extract-greeting", pinKey: "output" }, to: { nodeId: "to-string-greeting", pinKey: "value" } },
    { id: "d15", from: { nodeId: "to-string-greeting", pinKey: "text" }, to: { nodeId: "output-greeting", pinKey: "value" } },
    { id: "d16", from: { nodeId: "script-extract-computed", pinKey: "output" }, to: { nodeId: "to-number-computed", pinKey: "value" } },
    { id: "d17", from: { nodeId: "to-number-computed", pinKey: "number" }, to: { nodeId: "output-computed", pinKey: "value" } },
    { id: "d18", from: { nodeId: "to-string-status", pinKey: "text" }, to: { nodeId: "output-status-ok", pinKey: "value" } },
    { id: "d19", from: { nodeId: "const-delay", pinKey: "value" }, to: { nodeId: "delay", pinKey: "ms" } },
    { id: "d20", from: { nodeId: "const-error-text", pinKey: "value" }, to: { nodeId: "show-error", pinKey: "text" } },
    { id: "d21", from: { nodeId: "to-string-status", pinKey: "text" }, to: { nodeId: "output-status-error", pinKey: "value" } },
    { id: "d22", from: { nodeId: "const-runtime-status", pinKey: "value" }, to: { nodeId: "output-status-runtime", pinKey: "value" } },
  ],
};
