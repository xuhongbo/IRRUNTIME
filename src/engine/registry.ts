// 文件说明：自动补充文件级注释，描述模块职责与用途

// 节点注册表：集中定义节点类型、端口与运行逻辑
import { z } from "zod";
import type { Graph, NodeInstance } from "./ir";
import { normalizeContract } from "./contract";
import { runScriptInSandbox, runScriptInWorker } from "./scriptRunner";
import { normalizeVarName } from "./vars";
import type { ChoiceOption, ViewModel } from "./viewModel";

// 引脚定义：描述端口类型与数据约束
export type PinDef = {
  key: string;
  label: string;
  kind: "exec" | "data";
  dataType?: "string" | "number" | "boolean" | "json";
  required?: boolean;
  defaultValue?: unknown;
};

// 节点属性表单定义：用于面板编辑
export type FormFieldDef = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "textarea" | "json" | "array";
  options?: { value: string; label: string }[];
  placeholder?: string;
  helpText?: string;
};

// 节点运行上下文：提供输入、属性、变量与图信息
export type NodeRunContext = {
  node: NodeInstance;
  inputs: Record<string, unknown>;
  props: Record<string, unknown>;
  graph: Graph;
  vars: Record<string, unknown>;
};

// 挂起标记：用于等待继续、选择或延迟
export type LatentToken =
  | { kind: "next"; resumeExec: string }
  | {
      kind: "choice";
      options: ChoiceOption[];
      execByChoice: Record<string, string>;
      outputsByChoice: Record<string, Record<string, unknown>>;
    }
  | { kind: "delay"; ms: number; resumeExec: string };

// 节点运行结果：包含输出、执行引脚与可选视图模型
export type RunResult = {
  data: Record<string, unknown>;
  exec?: string;
  viewModel?: ViewModel;
  latent?: LatentToken;
  subgraph?: { graphId: string };
  deferred?: Promise<RunResult>;
  logs?: string[];
  error?: string;
};

// 节点定义：描述端口、属性与运行函数
export type NodeDefinition = {
  type: string;
  version: number;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  doc?: {
    summary: string;
    inputs?: string[];
    outputs?: string[];
  };
  inputs: PinDef[];
  outputs: PinDef[];
  propsSchema: z.ZodType<unknown>;
  defaultProps: Record<string, unknown>;
  form: FormFieldDef[];
  run: (ctx: NodeRunContext) => RunResult;
};

// 节点迁移记录：用于版本升级追踪
export type MigrationRecord = {
  nodeId: string;
  type: string;
  fromVersion: number;
  toVersion: number;
};

// 注册表接口：查询、列出与迁移
export type Registry = {
  get: (type: string, version?: number) => NodeDefinition | null;
  getLatest: (type: string) => NodeDefinition | null;
  listTypes: () => string[];
  migrateGraph: (graph: Graph) => { graph: Graph; migrations: MigrationRecord[] };
};

// 起始节点：执行流入口
const startNode: NodeDefinition = {
  type: "Start",
  version: 1,
  title: "Start",
  description: "Entry point of a graph.",
  category: "入口",
  doc: { summary: "图执行入口。" },
  inputs: [],
  outputs: [{ key: "next", label: "Next", kind: "exec" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: () => ({ data: {}, exec: "next" }),
};

// 结束节点：终止执行
const endNode: NodeDefinition = {
  type: "End",
  version: 1,
  title: "End",
  description: "Terminate execution.",
  category: "入口",
  doc: { summary: "图执行终点。" },
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: () => ({
    data: {},
    exec: undefined,
    viewModel: { kind: "done", title: "Complete", body: "Graph finished." },
  }),
};

// 图输入节点：将图输入映射为数据输出
const graphInputNode: NodeDefinition = {
  type: "GraphInput",
  version: 1,
  title: "Graph Input",
  description: "Expose a typed graph input value.",
  category: "流程",
  doc: { summary: "读取图输入并输出值。" },
  inputs: [],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "json", required: true }],
  propsSchema: z.object({ name: z.string().default("") }).strict(),
  defaultProps: { name: "" },
  form: [
    {
      key: "name",
      label: "Input Name",
      type: "select",
      options: [],
      placeholder: "Select contract input",
    },
  ],
  run: (ctx) => ({
    data: { value: ctx.inputs.value },
    exec: undefined,
    viewModel: {
      kind: "text",
      title: "Graph Input",
      body: `Input ${String(ctx.props.name ?? "")} read.`,
    },
  }),
};

// 图输出节点：收集图输出
const graphOutputNode: NodeDefinition = {
  type: "GraphOutput",
  version: 1,
  title: "Graph Output",
  description: "Capture a typed graph output value.",
  category: "流程",
  doc: { summary: "将输入写入图输出。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json", required: true },
  ],
  outputs: [{ key: "out", label: "Out", kind: "exec" }],
  propsSchema: z.object({ name: z.string().default("") }).strict(),
  defaultProps: { name: "" },
  form: [
    {
      key: "name",
      label: "Output Name",
      type: "select",
      options: [],
      placeholder: "Select contract output",
    },
  ],
  run: (ctx) => ({
    data: { value: ctx.inputs.value },
    exec: "out",
    viewModel: {
      kind: "text",
      title: "Graph Output",
      body: `Output ${String(ctx.props.name ?? "")} captured.`,
    },
  }),
};

// 脚本节点：在沙箱中执行脚本
const scriptNode: NodeDefinition = {
  type: "Script",
  version: 1,
  title: "Script",
  description: "Execute a sandboxed script with deterministic utilities.",
  category: "脚本",
  doc: { summary: "执行沙箱脚本并输出结果。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "input", label: "Input", kind: "data", dataType: "json", required: false },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "onError", label: "On Error", kind: "exec" },
    { key: "output", label: "Output", kind: "data", dataType: "json" },
  ],
  propsSchema: z
    .object({
      code: z.string().default("return { output: inputs.input };"),
      timeoutMs: z.number().min(10).max(10000).default(500),
      maxOutputSize: z.number().min(1000).max(200000).default(20000),
      maxLogEntries: z.number().min(1).max(200).default(50),
      maxLogChars: z.number().min(50).max(2000).default(500),
    })
    .strict(),
  defaultProps: {
    code: "return { output: inputs.input };",
    timeoutMs: 500,
    maxOutputSize: 20000,
    maxLogEntries: 50,
    maxLogChars: 500,
  },
  form: [
    { key: "code", label: "Code", type: "textarea" },
    { key: "timeoutMs", label: "Timeout (ms)", type: "number" },
    { key: "maxOutputSize", label: "Max Output (chars)", type: "number" },
    { key: "maxLogEntries", label: "Max Logs", type: "number" },
    { key: "maxLogChars", label: "Max Log Size", type: "number" },
  ],
  run: (ctx) => {
    const code = String(ctx.props.code ?? "");
    const timeoutMs = Number(ctx.props.timeoutMs ?? 500);
    const maxOutputSize = Number(ctx.props.maxOutputSize ?? 20000);
    const maxLogEntries = Number(ctx.props.maxLogEntries ?? 50);
    const maxLogChars = Number(ctx.props.maxLogChars ?? 500);
    const context = { vars: ctx.vars, graphId: ctx.graph.id };
    const deferred = runScriptInWorker({
      code,
      inputs: { input: ctx.inputs.input },
      context,
      timeoutMs,
      maxOutputSize,
      maxLogEntries,
      maxLogChars,
      seed: 0,
    }).then((result) => ({
      data: { output: result.data.output ?? result.data },
      exec: "out",
      viewModel: { kind: "text", title: "Script", body: "Script executed." },
      logs: result.logs,
    }));
    return { data: {}, deferred };
  },
};

// 写变量节点：写入运行时变量
const setVarNode: NodeDefinition = {
  type: "SetVar",
  version: 1,
  title: "Set Variable",
  description: "Write a value into the runtime variable store.",
  category: "变量",
  doc: { summary: "写入运行时变量。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "name", label: "Name", kind: "data", dataType: "string", required: true },
    { key: "value", label: "Value", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const rawName = String(ctx.inputs.name ?? "");
    const name = normalizeVarName(rawName);
    if (!name) {
      return {
        data: {},
        exec: "out",
        error: "Variable name is required.",
        viewModel: { kind: "error", title: "SetVar", body: "Variable name is required." },
      };
    }
    ctx.vars[name] = ctx.inputs.value;
    return {
      data: { value: ctx.inputs.value },
      exec: "out",
      viewModel: { kind: "text", title: "SetVar", body: `var ${name} updated.` },
    };
  },
};

// 读变量节点：读取运行时变量
const getVarNode: NodeDefinition = {
  type: "GetVar",
  version: 1,
  title: "Get Variable",
  description: "Read a value from the runtime variable store.",
  category: "变量",
  doc: { summary: "读取运行时变量。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "name", label: "Name", kind: "data", dataType: "string", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const rawName = String(ctx.inputs.name ?? "");
    const name = normalizeVarName(rawName);
    if (!name) {
      return {
        data: { value: undefined },
        exec: "out",
        error: "Variable name is required.",
        viewModel: { kind: "error", title: "GetVar", body: "Variable name is required." },
      };
    }
    return {
      data: { value: ctx.vars[name] },
      exec: "out",
      viewModel: { kind: "text", title: "GetVar", body: `var ${name} read.` },
    };
  },
};

// 条件节点：根据布尔值分支
const ifNode: NodeDefinition = {
  type: "If",
  version: 1,
  title: "If",
  description: "Branch based on a boolean condition.",
  category: "逻辑",
  doc: { summary: "基于条件分支执行。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "condition", label: "Condition", kind: "data", dataType: "boolean", required: true },
  ],
  outputs: [
    { key: "then", label: "Then", kind: "exec" },
    { key: "else", label: "Else", kind: "exec" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const condition = Boolean(ctx.inputs.condition);
    return {
      data: {},
      exec: condition ? "then" : "else",
      viewModel: {
        kind: "text",
        title: "If",
        body: `Condition evaluated to ${condition ? "true" : "false"}.`,
      },
    };
  },
};

// 相等比较节点
const equalsNode: NodeDefinition = {
  type: "Equals",
  version: 1,
  title: "Equals",
  description: "Compare two values for strict equality.",
  category: "逻辑",
  doc: { summary: "比较两个值是否相等。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "a", label: "A", kind: "data", dataType: "json", required: true },
    { key: "b", label: "B", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "isEqual", label: "Is Equal", kind: "data", dataType: "boolean" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => ({
    data: { isEqual: ctx.inputs.a === ctx.inputs.b },
    exec: "out",
    viewModel: {
      kind: "text",
      title: "Equals",
      body: `Compared values -> ${ctx.inputs.a === ctx.inputs.b ? "equal" : "not equal"}.`,
    },
  }),
};

// 常量字符串节点
const constStringNode: NodeDefinition = {
  type: "ConstString",
  version: 1,
  title: "Const String",
  description: "Emit a string literal.",
  category: "常量",
  doc: { summary: "输出字符串常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "string" }],
  propsSchema: z.object({ value: z.string().default("") }).strict(),
  defaultProps: { value: "" },
  form: [{ key: "value", label: "Value", type: "string" }],
  run: (ctx) => ({
    data: { value: String(ctx.props.value ?? "") },
    viewModel: { kind: "text", title: "Const", body: "String literal emitted." },
  }),
};

// 常量数字节点
const constNumberNode: NodeDefinition = {
  type: "ConstNumber",
  version: 1,
  title: "Const Number",
  description: "Emit a number literal.",
  category: "常量",
  doc: { summary: "输出数字常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "number" }],
  propsSchema: z.object({ value: z.number().default(0) }).strict(),
  defaultProps: { value: 0 },
  form: [{ key: "value", label: "Value", type: "number" }],
  run: (ctx) => ({
    data: { value: Number(ctx.props.value ?? 0) },
    viewModel: { kind: "text", title: "Const", body: "Number literal emitted." },
  }),
};

// 常量布尔节点
const constBooleanNode: NodeDefinition = {
  type: "ConstBoolean",
  version: 1,
  title: "Const Boolean",
  description: "Emit a boolean literal.",
  category: "常量",
  doc: { summary: "输出布尔常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "boolean" }],
  propsSchema: z.object({ value: z.boolean().default(false) }).strict(),
  defaultProps: { value: false },
  form: [{ key: "value", label: "Value", type: "boolean" }],
  run: (ctx) => ({
    data: { value: Boolean(ctx.props.value) },
    viewModel: { kind: "text", title: "Const", body: "Boolean literal emitted." },
  }),
};

// 常量 JSON 节点
const constJsonNode: NodeDefinition = {
  type: "ConstJson",
  version: 1,
  title: "Const JSON",
  description: "Emit a JSON literal.",
  category: "常量",
  doc: { summary: "输出 JSON 常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "json" }],
  propsSchema: z.object({ value: z.unknown() }).strict(),
  defaultProps: { value: { sample: true } },
  form: [{ key: "value", label: "Value", type: "json" }],
  run: (ctx) => ({
    data: { value: ctx.props.value },
    viewModel: { kind: "text", title: "Const", body: "JSON literal emitted." },
  }),
};

// 类型转换：转数字
const toNumberNode: NodeDefinition = {
  type: "ToNumber",
  version: 1,
  title: "To Number",
  description: "Convert a JSON value into a number.",
  category: "转换",
  doc: { summary: "将输入转换为数字。" },
  inputs: [{ key: "value", label: "Value", kind: "data", dataType: "json", required: true }],
  outputs: [{ key: "number", label: "Number", kind: "data", dataType: "number" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const num = Number(ctx.inputs.value);
    if (Number.isNaN(num)) {
      throw new Error("Value cannot be converted to number.");
    }
    return {
      data: { number: num },
      viewModel: { kind: "text", title: "ToNumber", body: `Converted to ${num}.` },
    };
  },
};

// 类型转换：转字符串
const toStringNode: NodeDefinition = {
  type: "ToString",
  version: 1,
  title: "To String",
  description: "Convert a JSON value into a string.",
  category: "转换",
  doc: { summary: "将输入转换为字符串。" },
  inputs: [{ key: "value", label: "Value", kind: "data", dataType: "json", required: true }],
  outputs: [{ key: "text", label: "Text", kind: "data", dataType: "string" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => ({
    data: { text: String(ctx.inputs.value ?? "") },
    viewModel: { kind: "text", title: "ToString", body: "Converted to string." },
  }),
};

// 展示文本节点：等待用户继续
const showTextNodeV2: NodeDefinition = {
  type: "ShowText",
  version: 2,
  title: "Show Text",
  description: "Display a message and wait for user NEXT.",
  category: "交互",
  doc: { summary: "展示文本并等待继续。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "text", label: "Text", kind: "data", dataType: "string", required: true },
  ],
  outputs: [{ key: "out", label: "Out", kind: "exec" }],
  propsSchema: z
    .object({
      title: z.string().default("Message"),
    })
    .strict(),
  defaultProps: { title: "Message" },
  form: [
    { key: "title", label: "Title", type: "string", placeholder: "Panel title" },
  ],
  run: (ctx) => ({
    data: {},
    exec: "out",
    viewModel: {
      kind: "text",
      title: String(ctx.props.title ?? "Message"),
      body: String(ctx.inputs.text ?? ""),
    },
    latent: { kind: "next", resumeExec: "out" },
  }),
};

// 选择节点：等待用户选择分支
const waitChoiceNode: NodeDefinition = {
  type: "WaitForChoice",
  version: 1,
  title: "Wait For Choice",
  description: "Pause execution until the user selects a choice.",
  category: "交互",
  doc: { summary: "等待用户选择分支。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "prompt", label: "Prompt", kind: "data", dataType: "string", required: true },
  ],
  outputs: [
    { key: "choiceA", label: "Choice A", kind: "exec" },
    { key: "choiceB", label: "Choice B", kind: "exec" },
    { key: "choice", label: "Choice", kind: "data", dataType: "string" },
  ],
  propsSchema: z
    .object({
      choiceALabel: z.string().default("Continue"),
      choiceBLabel: z.string().default("Trigger Error"),
    })
    .strict(),
  defaultProps: { choiceALabel: "Continue", choiceBLabel: "Trigger Error" },
  form: [
    { key: "choiceALabel", label: "Choice A Label", type: "string" },
    { key: "choiceBLabel", label: "Choice B Label", type: "string" },
  ],
  run: (ctx) => {
    const choiceA: ChoiceOption = {
      key: "choiceA",
      label: String(ctx.props.choiceALabel ?? "Continue"),
    };
    const choiceB: ChoiceOption = {
      key: "choiceB",
      label: String(ctx.props.choiceBLabel ?? "Trigger Error"),
    };
    return {
      data: {},
      viewModel: {
        kind: "choice",
        title: "Make a Choice",
        body: String(ctx.inputs.prompt ?? ""),
        choices: [choiceA, choiceB],
      },
      latent: {
        kind: "choice",
        options: [choiceA, choiceB],
        execByChoice: {
          choiceA: "choiceA",
          choiceB: "choiceB",
        },
        outputsByChoice: {
          choiceA: { choice: "choiceA" },
          choiceB: { choice: "choiceB" },
        },
      },
    };
  },
};

// 延迟节点：等待指定毫秒
const delayNode: NodeDefinition = {
  type: "Delay",
  version: 1,
  title: "Delay",
  description: "Pause execution for a duration before continuing.",
  category: "时间",
  doc: { summary: "延迟指定时间后继续。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "ms", label: "Milliseconds", kind: "data", dataType: "number", required: true },
  ],
  outputs: [{ key: "out", label: "Out", kind: "exec" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const ms = Number(ctx.inputs.ms ?? 0);
    return {
      data: {},
      exec: "out",
      viewModel: {
        kind: "waiting",
        title: "Delay",
        body: `Waiting ${ms} ms...`,
      },
      latent: { kind: "delay", ms, resumeExec: "out" },
    };
  },
};

// 表达式节点：轻量计算
const expressionNode: NodeDefinition = {
  type: "Expression",
  version: 1,
  title: "Expression",
  description: "Evaluate a lightweight expression with inputs and vars.",
  category: "脚本",
  doc: { summary: "执行轻量表达式。" },
  inputs: [{ key: "input", label: "Input", kind: "data", dataType: "json", required: false }],
  outputs: [{ key: "value", label: "Value", kind: "data", dataType: "json" }],
  propsSchema: z
    .object({
      expression: z.string().default("inputs.input"),
      timeoutMs: z.number().min(10).max(10000).default(200),
      maxOutputSize: z.number().min(1000).max(200000).default(20000),
      maxLogEntries: z.number().min(1).max(200).default(20),
      maxLogChars: z.number().min(50).max(2000).default(300),
    })
    .strict(),
  defaultProps: {
    expression: "inputs.input",
    timeoutMs: 200,
    maxOutputSize: 20000,
    maxLogEntries: 20,
    maxLogChars: 300,
  },
  form: [
    { key: "expression", label: "Expression", type: "textarea" },
    { key: "timeoutMs", label: "Timeout (ms)", type: "number" },
  ],
  run: (ctx) => {
    const expression = String(ctx.props.expression ?? "");
    if (!expression.trim()) {
      return {
        data: { value: null },
        error: "Expression is empty.",
        viewModel: { kind: "error", title: "Expression", body: "Expression is empty." },
      };
    }
    const code = `return { value: (${expression}) };`;
    const result = runScriptInSandbox({
      code,
      inputs: { input: ctx.inputs.input },
      context: { vars: ctx.vars },
      timeoutMs: Number(ctx.props.timeoutMs ?? 200),
      maxOutputSize: Number(ctx.props.maxOutputSize ?? 20000),
      maxLogEntries: Number(ctx.props.maxLogEntries ?? 20),
      maxLogChars: Number(ctx.props.maxLogChars ?? 300),
      seed: 0,
    });
    return {
      data: { value: result.data.value },
      viewModel: { kind: "text", title: "Expression", body: "Expression evaluated." },
      logs: result.logs,
    };
  },
};

// 除法节点：处理除零异常
const divideNode: NodeDefinition = {
  type: "Divide",
  version: 1,
  title: "Divide",
  description: "Divide A by B. Throws error on division by zero.",
  category: "逻辑",
  doc: { summary: "执行除法并处理除零。" },
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "a", label: "A", kind: "data", dataType: "number", required: true },
    { key: "b", label: "B", kind: "data", dataType: "number", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "onError", label: "On Error", kind: "exec" },
    { key: "result", label: "Result", kind: "data", dataType: "number" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const a = Number(ctx.inputs.a ?? 0);
    const b = Number(ctx.inputs.b ?? 0);
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return {
      data: { result: a / b },
      exec: "out",
      viewModel: {
        kind: "text",
        title: "Divide",
        body: `${a} / ${b} = ${a / b}`,
      },
    };
  },
};

// 子图节点：进入子图执行
const subgraphNode: NodeDefinition = {
  type: "Subgraph",
  version: 1,
  title: "Subgraph",
  description: "Invoke a nested subgraph by id.",
  category: "子图",
  doc: { summary: "调用子图执行。" },
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [{ key: "out", label: "Out", kind: "exec" }],
  propsSchema: z
    .object({
      subgraphId: z.string().min(1),
    })
    .strict(),
  defaultProps: { subgraphId: "" },
  form: [
    { key: "subgraphId", label: "Subgraph Id", type: "string" },
  ],
  run: (ctx) => ({
    data: {},
    exec: "out",
    viewModel: {
      kind: "text",
      title: "Subgraph",
      body: `Entering subgraph ${String(ctx.props.subgraphId ?? "")}.`,
    },
    subgraph: { graphId: String(ctx.props.subgraphId ?? "") },
  }),
};

// 节点定义集合
const definitions: NodeDefinition[] = [
  startNode,
  endNode,
  graphInputNode,
  graphOutputNode,
  scriptNode,
  setVarNode,
  getVarNode,
  ifNode,
  equalsNode,
  constStringNode,
  constNumberNode,
  constBooleanNode,
  constJsonNode,
  toNumberNode,
  toStringNode,
  showTextNodeV2,
  waitChoiceNode,
  delayNode,
  expressionNode,
  divideNode,
  subgraphNode,
];

// 版本迁移表：用于节点属性升级
const migrations: Record<string, Record<number, (props: Record<string, unknown>) => Record<string, unknown>>> = {
  ShowText: {
    1: (props) => ({
      title: typeof props.label === "string" ? props.label : "Message",
    }),
  },
};

// 注册表实现：提供查询与迁移能力
export const registry: Registry = {
  get: (type, version) => {
    if (version === undefined) {
      return definitions.find((def) => def.type === type) ?? null;
    }
    return definitions.find((def) => def.type === type && def.version === version) ?? null;
  },
  getLatest: (type) => {
    const defs = definitions.filter((def) => def.type === type);
    if (defs.length === 0) return null;
    return defs.reduce((latest, def) => (def.version > latest.version ? def : latest));
  },
  listTypes: () => Array.from(new Set(definitions.map((def) => def.type))).sort(),
  migrateGraph: (graph) => {
    const migrationsApplied: MigrationRecord[] = [];
    const migratedNodes = graph.nodes.map((node) => {
      const latest = registry.getLatest(node.type);
      if (!latest || latest.version === node.version) {
        return node;
      }
      let currentVersion = node.version;
      let currentProps = { ...node.props };
      while (currentVersion < latest.version) {
        const migrateFn = migrations[node.type]?.[currentVersion];
        if (!migrateFn) break;
        const nextProps = migrateFn(currentProps);
        migrationsApplied.push({
          nodeId: node.id,
          type: node.type,
          fromVersion: currentVersion,
          toVersion: currentVersion + 1,
        });
        currentVersion += 1;
        currentProps = nextProps;
      }
      return {
        ...node,
        version: currentVersion,
        props: currentProps,
      };
    });
    return {
      graph: {
        ...graph,
        nodes: migratedNodes,
        contract: normalizeContract(graph.contract),
        presets: graph.presets ?? [],
      },
      migrations: migrationsApplied,
    };
  },
};
