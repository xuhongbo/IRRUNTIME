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
  title: "开始",
  description: "流程入口。",
  category: "入口",
  doc: { summary: "图执行入口。" },
  inputs: [],
  outputs: [{ key: "next", label: "下一步", kind: "exec" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: () => ({ data: {}, exec: "next" }),
};

// 结束节点：终止执行
const endNode: NodeDefinition = {
  type: "End",
  version: 1,
  title: "结束",
  description: "终止执行。",
  category: "入口",
  doc: { summary: "图执行终点。" },
  inputs: [{ key: "in", label: "进入", kind: "exec" }],
  outputs: [],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: () => ({
    data: {},
    exec: undefined,
    viewModel: { kind: "done", title: "完成", body: "流程已结束。" },
  }),
};

// 图输入节点：将图输入映射为数据输出
const graphInputNode: NodeDefinition = {
  type: "GraphInput",
  version: 1,
  title: "图输入",
  description: "暴露图输入值。",
  category: "流程",
  doc: { summary: "读取图输入并输出值。" },
  inputs: [],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "json", required: true }],
  propsSchema: z.object({ name: z.string().default("") }).strict(),
  defaultProps: { name: "" },
  form: [
    {
      key: "name",
      label: "输入名称",
      type: "select",
      options: [],
      placeholder: "选择合约输入",
    },
  ],
  run: (ctx) => ({
    data: { value: ctx.inputs.value },
    exec: undefined,
    viewModel: {
      kind: "text",
      title: "图输入",
      body: `输入 ${String(ctx.props.name ?? "")} 已读取。`,
    },
  }),
};

// 图输出节点：收集图输出
const graphOutputNode: NodeDefinition = {
  type: "GraphOutput",
  version: 1,
  title: "图输出",
  description: "写入图输出值。",
  category: "流程",
  doc: { summary: "将输入写入图输出。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "value", label: "值", kind: "data", dataType: "json", required: true },
  ],
  outputs: [{ key: "out", label: "输出", kind: "exec" }],
  propsSchema: z.object({ name: z.string().default("") }).strict(),
  defaultProps: { name: "" },
  form: [
    {
      key: "name",
      label: "输出名称",
      type: "select",
      options: [],
      placeholder: "选择合约输出",
    },
  ],
  run: (ctx) => ({
    data: { value: ctx.inputs.value },
    exec: "out",
    viewModel: {
      kind: "text",
      title: "图输出",
      body: `输出 ${String(ctx.props.name ?? "")} 已写入。`,
    },
  }),
};

// 脚本节点：在沙箱中执行脚本
const scriptNode: NodeDefinition = {
  type: "Script",
  version: 1,
  title: "脚本",
  description: "使用确定性工具执行沙箱脚本。",
  category: "脚本",
  doc: { summary: "执行沙箱脚本并输出结果。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "input", label: "输入", kind: "data", dataType: "json", required: false },
  ],
  outputs: [
    { key: "out", label: "输出", kind: "exec" },
    { key: "onError", label: "错误", kind: "exec" },
    { key: "output", label: "结果", kind: "data", dataType: "json" },
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
    { key: "code", label: "脚本代码", type: "textarea" },
    { key: "timeoutMs", label: "超时（毫秒）", type: "number" },
    { key: "maxOutputSize", label: "最大输出长度（字符）", type: "number" },
    { key: "maxLogEntries", label: "最大日志条数", type: "number" },
    { key: "maxLogChars", label: "最大日志长度", type: "number" },
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
      viewModel: { kind: "text", title: "脚本", body: "脚本已执行。" },
      logs: result.logs,
    }));
    return { data: {}, deferred };
  },
};

// 写变量节点：写入运行时变量
const setVarNode: NodeDefinition = {
  type: "SetVar",
  version: 1,
  title: "设置变量",
  description: "写入运行时变量。",
  category: "变量",
  doc: { summary: "写入运行时变量。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "name", label: "名称", kind: "data", dataType: "string", required: true },
    { key: "value", label: "值", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "输出", kind: "exec" },
    { key: "value", label: "值", kind: "data", dataType: "json" },
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
        error: "变量名不能为空。",
        viewModel: { kind: "error", title: "设置变量", body: "变量名不能为空。" },
      };
    }
    ctx.vars[name] = ctx.inputs.value;
    return {
      data: { value: ctx.inputs.value },
      exec: "out",
      viewModel: { kind: "text", title: "设置变量", body: `变量 ${name} 已更新。` },
    };
  },
};

// 读变量节点：读取运行时变量
const getVarNode: NodeDefinition = {
  type: "GetVar",
  version: 1,
  title: "读取变量",
  description: "读取运行时变量。",
  category: "变量",
  doc: { summary: "读取运行时变量。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "name", label: "名称", kind: "data", dataType: "string", required: true },
  ],
  outputs: [
    { key: "out", label: "输出", kind: "exec" },
    { key: "value", label: "值", kind: "data", dataType: "json" },
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
        error: "变量名不能为空。",
        viewModel: { kind: "error", title: "读取变量", body: "变量名不能为空。" },
      };
    }
    return {
      data: { value: ctx.vars[name] },
      exec: "out",
      viewModel: { kind: "text", title: "读取变量", body: `变量 ${name} 已读取。` },
    };
  },
};

// 条件节点：根据布尔值分支
const ifNode: NodeDefinition = {
  type: "If",
  version: 1,
  title: "条件判断",
  description: "根据布尔条件进行分支。",
  category: "逻辑",
  doc: { summary: "基于条件分支执行。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "condition", label: "条件", kind: "data", dataType: "boolean", required: true },
  ],
  outputs: [
    { key: "then", label: "成立", kind: "exec" },
    { key: "else", label: "否则", kind: "exec" },
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
        title: "条件判断",
        body: `条件结果为 ${condition ? "真" : "假"}。`,
      },
    };
  },
};

// 相等比较节点
const equalsNode: NodeDefinition = {
  type: "Equals",
  version: 1,
  title: "相等比较",
  description: "比较两个值是否严格相等。",
  category: "逻辑",
  doc: { summary: "比较两个值是否相等。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "a", label: "A", kind: "data", dataType: "json", required: true },
    { key: "b", label: "B", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "输出", kind: "exec" },
    { key: "isEqual", label: "是否相等", kind: "data", dataType: "boolean" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => ({
    data: { isEqual: ctx.inputs.a === ctx.inputs.b },
    exec: "out",
    viewModel: {
      kind: "text",
      title: "相等比较",
      body: `比较结果：${ctx.inputs.a === ctx.inputs.b ? "相等" : "不相等"}。`,
    },
  }),
};

// 常量字符串节点
const constStringNode: NodeDefinition = {
  type: "ConstString",
  version: 1,
  title: "字符串常量",
  description: "输出字符串常量。",
  category: "常量",
  doc: { summary: "输出字符串常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "string" }],
  propsSchema: z.object({ value: z.string().default("") }).strict(),
  defaultProps: { value: "" },
  form: [{ key: "value", label: "值", type: "string" }],
  run: (ctx) => ({
    data: { value: String(ctx.props.value ?? "") },
    viewModel: { kind: "text", title: "常量", body: "字符串常量已输出。" },
  }),
};

// 常量数字节点
const constNumberNode: NodeDefinition = {
  type: "ConstNumber",
  version: 1,
  title: "数字常量",
  description: "输出数字常量。",
  category: "常量",
  doc: { summary: "输出数字常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "number" }],
  propsSchema: z.object({ value: z.number().default(0) }).strict(),
  defaultProps: { value: 0 },
  form: [{ key: "value", label: "值", type: "number" }],
  run: (ctx) => ({
    data: { value: Number(ctx.props.value ?? 0) },
    viewModel: { kind: "text", title: "常量", body: "数字常量已输出。" },
  }),
};

// 常量布尔节点
const constBooleanNode: NodeDefinition = {
  type: "ConstBoolean",
  version: 1,
  title: "布尔常量",
  description: "输出布尔常量。",
  category: "常量",
  doc: { summary: "输出布尔常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "boolean" }],
  propsSchema: z.object({ value: z.boolean().default(false) }).strict(),
  defaultProps: { value: false },
  form: [{ key: "value", label: "值", type: "boolean" }],
  run: (ctx) => ({
    data: { value: Boolean(ctx.props.value) },
    viewModel: { kind: "text", title: "常量", body: "布尔常量已输出。" },
  }),
};

// 常量 JSON 节点
const constJsonNode: NodeDefinition = {
  type: "ConstJson",
  version: 1,
  title: "JSON 常量",
  description: "输出 JSON 常量。",
  category: "常量",
  doc: { summary: "输出 JSON 常量。" },
  inputs: [],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "json" }],
  propsSchema: z.object({ value: z.unknown() }).strict(),
  defaultProps: { value: { sample: true } },
  form: [{ key: "value", label: "值", type: "json" }],
  run: (ctx) => ({
    data: { value: ctx.props.value },
    viewModel: { kind: "text", title: "常量", body: "JSON 常量已输出。" },
  }),
};

// 类型转换：转数字
const toNumberNode: NodeDefinition = {
  type: "ToNumber",
  version: 1,
  title: "转为数字",
  description: "将 JSON 值转换为数字。",
  category: "转换",
  doc: { summary: "将输入转换为数字。" },
  inputs: [{ key: "value", label: "值", kind: "data", dataType: "json", required: true }],
  outputs: [{ key: "number", label: "数字", kind: "data", dataType: "number" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const num = Number(ctx.inputs.value);
    if (Number.isNaN(num)) {
      throw new Error("值无法转换为数字。");
    }
    return {
      data: { number: num },
      viewModel: { kind: "text", title: "转为数字", body: `已转换为 ${num}。` },
    };
  },
};

// 类型转换：转字符串
const toStringNode: NodeDefinition = {
  type: "ToString",
  version: 1,
  title: "转为字符串",
  description: "将 JSON 值转换为字符串。",
  category: "转换",
  doc: { summary: "将输入转换为字符串。" },
  inputs: [{ key: "value", label: "值", kind: "data", dataType: "json", required: true }],
  outputs: [{ key: "text", label: "文本", kind: "data", dataType: "string" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => ({
    data: { text: String(ctx.inputs.value ?? "") },
    viewModel: { kind: "text", title: "转为字符串", body: "已转换为字符串。" },
  }),
};

// 展示文本节点：等待用户继续
const showTextNodeV2: NodeDefinition = {
  type: "ShowText",
  version: 2,
  title: "展示文本",
  description: "展示消息并等待用户继续。",
  category: "交互",
  doc: { summary: "展示文本并等待继续。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "text", label: "文本", kind: "data", dataType: "string", required: true },
  ],
  outputs: [{ key: "out", label: "输出", kind: "exec" }],
  propsSchema: z
    .object({
      title: z.string().default("消息"),
    })
    .strict(),
  defaultProps: { title: "消息" },
  form: [
    { key: "title", label: "标题", type: "string", placeholder: "面板标题" },
  ],
  run: (ctx) => ({
    data: {},
    exec: "out",
    viewModel: {
      kind: "text",
      title: String(ctx.props.title ?? "消息"),
      body: String(ctx.inputs.text ?? ""),
    },
    latent: { kind: "next", resumeExec: "out" },
  }),
};

// 选择节点：等待用户选择分支
const waitChoiceNode: NodeDefinition = {
  type: "WaitForChoice",
  version: 1,
  title: "等待选择",
  description: "暂停执行直到用户做出选择。",
  category: "交互",
  doc: { summary: "等待用户选择分支。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "prompt", label: "提示文本", kind: "data", dataType: "string", required: true },
  ],
  outputs: [
    { key: "choiceA", label: "选项 A", kind: "exec" },
    { key: "choiceB", label: "选项 B", kind: "exec" },
    { key: "choice", label: "选择", kind: "data", dataType: "string" },
  ],
  propsSchema: z
    .object({
      choiceALabel: z.string().default("继续"),
      choiceBLabel: z.string().default("触发错误"),
    })
    .strict(),
  defaultProps: { choiceALabel: "继续", choiceBLabel: "触发错误" },
  form: [
    { key: "choiceALabel", label: "选项 A 文案", type: "string" },
    { key: "choiceBLabel", label: "选项 B 文案", type: "string" },
  ],
  run: (ctx) => {
    const choiceA: ChoiceOption = {
      key: "choiceA",
      label: String(ctx.props.choiceALabel ?? "继续"),
    };
    const choiceB: ChoiceOption = {
      key: "choiceB",
      label: String(ctx.props.choiceBLabel ?? "触发错误"),
    };
    return {
      data: {},
      viewModel: {
        kind: "choice",
        title: "请选择",
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
  title: "延迟",
  description: "暂停执行指定时长后继续。",
  category: "时间",
  doc: { summary: "延迟指定时间后继续。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "ms", label: "毫秒", kind: "data", dataType: "number", required: true },
  ],
  outputs: [{ key: "out", label: "输出", kind: "exec" }],
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
        title: "延迟",
        body: `等待 ${ms} 毫秒...`,
      },
      latent: { kind: "delay", ms, resumeExec: "out" },
    };
  },
};

// 表达式节点：轻量计算
const expressionNode: NodeDefinition = {
  type: "Expression",
  version: 1,
  title: "表达式",
  description: "使用输入与变量执行轻量表达式。",
  category: "脚本",
  doc: { summary: "执行轻量表达式。" },
  inputs: [{ key: "input", label: "输入", kind: "data", dataType: "json", required: false }],
  outputs: [{ key: "value", label: "值", kind: "data", dataType: "json" }],
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
    { key: "expression", label: "表达式", type: "textarea" },
    { key: "timeoutMs", label: "超时（毫秒）", type: "number" },
  ],
  run: (ctx) => {
    const expression = String(ctx.props.expression ?? "");
    if (!expression.trim()) {
      return {
        data: { value: null },
        error: "表达式为空。",
        viewModel: { kind: "error", title: "表达式", body: "表达式为空。" },
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
      viewModel: { kind: "text", title: "表达式", body: "表达式已计算。" },
      logs: result.logs,
    };
  },
};

// 除法节点：处理除零异常
const divideNode: NodeDefinition = {
  type: "Divide",
  version: 1,
  title: "除法",
  description: "执行 A/B，除零时抛出错误。",
  category: "逻辑",
  doc: { summary: "执行除法并处理除零。" },
  inputs: [
    { key: "in", label: "进入", kind: "exec" },
    { key: "a", label: "A", kind: "data", dataType: "number", required: true },
    { key: "b", label: "B", kind: "data", dataType: "number", required: true },
  ],
  outputs: [
    { key: "out", label: "输出", kind: "exec" },
    { key: "onError", label: "错误", kind: "exec" },
    { key: "result", label: "结果", kind: "data", dataType: "number" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => {
    const a = Number(ctx.inputs.a ?? 0);
    const b = Number(ctx.inputs.b ?? 0);
    if (b === 0) {
      throw new Error("除数不能为 0");
    }
    return {
      data: { result: a / b },
      exec: "out",
      viewModel: {
        kind: "text",
        title: "除法",
        body: `${a} / ${b} = ${a / b}`,
      },
    };
  },
};

// 子图节点：进入子图执行
const subgraphNode: NodeDefinition = {
  type: "Subgraph",
  version: 1,
  title: "子图",
  description: "按 ID 调用子图。",
  category: "子图",
  doc: { summary: "调用子图执行。" },
  inputs: [{ key: "in", label: "进入", kind: "exec" }],
  outputs: [{ key: "out", label: "输出", kind: "exec" }],
  propsSchema: z
    .object({
      subgraphId: z.string().min(1),
    })
    .strict(),
  defaultProps: { subgraphId: "" },
  form: [
    { key: "subgraphId", label: "子图 ID", type: "string" },
  ],
  run: (ctx) => ({
    data: {},
    exec: "out",
    viewModel: {
      kind: "text",
      title: "子图",
      body: `进入子图 ${String(ctx.props.subgraphId ?? "")}。`,
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
      title: typeof props.label === "string" ? props.label : "消息",
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
