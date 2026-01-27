import { z } from "zod";
import type { Graph, NodeInstance } from "./ir";
import { normalizeContract } from "./contract";
import { runScriptInWorker } from "./scriptRunner";
import type { ChoiceOption, ViewModel } from "./viewModel";

export type PinDef = {
  key: string;
  label: string;
  kind: "exec" | "data";
  dataType?: "string" | "number" | "boolean" | "json";
  required?: boolean;
  defaultValue?: unknown;
};

export type FormFieldDef = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "textarea" | "json" | "array";
  options?: { value: string; label: string }[];
  placeholder?: string;
  helpText?: string;
};

export type NodeRunContext = {
  node: NodeInstance;
  inputs: Record<string, unknown>;
  props: Record<string, unknown>;
  graph: Graph;
  vars: Record<string, unknown>;
};

export type LatentToken =
  | { kind: "next"; resumeExec: string }
  | {
      kind: "choice";
      options: ChoiceOption[];
      execByChoice: Record<string, string>;
      outputsByChoice: Record<string, Record<string, unknown>>;
    }
  | { kind: "delay"; ms: number; resumeExec: string };

export type RunResult = {
  data: Record<string, unknown>;
  exec?: string;
  viewModel?: ViewModel;
  latent?: LatentToken;
  subgraph?: { graphId: string };
  deferred?: Promise<RunResult>;
  logs?: string[];
};

export type NodeDefinition = {
  type: string;
  version: number;
  title: string;
  description: string;
  inputs: PinDef[];
  outputs: PinDef[];
  propsSchema: z.ZodType<unknown>;
  defaultProps: Record<string, unknown>;
  form: FormFieldDef[];
  run: (ctx: NodeRunContext) => RunResult;
};

export type MigrationRecord = {
  nodeId: string;
  type: string;
  fromVersion: number;
  toVersion: number;
};

export type Registry = {
  get: (type: string, version?: number) => NodeDefinition | null;
  getLatest: (type: string) => NodeDefinition | null;
  listTypes: () => string[];
  migrateGraph: (graph: Graph) => { graph: Graph; migrations: MigrationRecord[] };
};

const startNode: NodeDefinition = {
  type: "Start",
  version: 1,
  title: "Start",
  description: "Entry point of a graph.",
  inputs: [],
  outputs: [{ key: "next", label: "Next", kind: "exec" }],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: () => ({ data: {}, exec: "next" }),
};

const endNode: NodeDefinition = {
  type: "End",
  version: 1,
  title: "End",
  description: "Terminate execution.",
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

const graphInputNode: NodeDefinition = {
  type: "GraphInput",
  version: 1,
  title: "Graph Input",
  description: "Expose a typed graph input value.",
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

const graphOutputNode: NodeDefinition = {
  type: "GraphOutput",
  version: 1,
  title: "Graph Output",
  description: "Capture a typed graph output value.",
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

const scriptNode: NodeDefinition = {
  type: "Script",
  version: 1,
  title: "Script",
  description: "Execute a sandboxed script with deterministic utilities.",
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

const setVarNode: NodeDefinition = {
  type: "SetVar",
  version: 1,
  title: "Set Variable",
  description: "Write a value into the runtime variable store.",
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
    const name = String(ctx.inputs.name ?? "");
    ctx.vars[name] = ctx.inputs.value;
    return {
      data: { value: ctx.inputs.value },
      exec: "out",
      viewModel: { kind: "text", title: "SetVar", body: `var ${name} updated.` },
    };
  },
};

const getVarNode: NodeDefinition = {
  type: "GetVar",
  version: 1,
  title: "Get Variable",
  description: "Read a value from the runtime variable store.",
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
    const name = String(ctx.inputs.name ?? "");
    return {
      data: { value: ctx.vars[name] },
      exec: "out",
      viewModel: { kind: "text", title: "GetVar", body: `var ${name} read.` },
    };
  },
};

const ifNode: NodeDefinition = {
  type: "If",
  version: 1,
  title: "If",
  description: "Branch based on a boolean condition.",
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

const equalsNode: NodeDefinition = {
  type: "Equals",
  version: 1,
  title: "Equals",
  description: "Compare two values for strict equality.",
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

const constStringNode: NodeDefinition = {
  type: "ConstString",
  version: 1,
  title: "Const String",
  description: "Emit a string literal.",
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "string" },
  ],
  propsSchema: z.object({ value: z.string().default("") }).strict(),
  defaultProps: { value: "" },
  form: [{ key: "value", label: "Value", type: "string" }],
  run: (ctx) => ({
    data: { value: String(ctx.props.value ?? "") },
    exec: "out",
    viewModel: { kind: "text", title: "Const", body: "String literal emitted." },
  }),
};

const constNumberNode: NodeDefinition = {
  type: "ConstNumber",
  version: 1,
  title: "Const Number",
  description: "Emit a number literal.",
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "number" },
  ],
  propsSchema: z.object({ value: z.number().default(0) }).strict(),
  defaultProps: { value: 0 },
  form: [{ key: "value", label: "Value", type: "number" }],
  run: (ctx) => ({
    data: { value: Number(ctx.props.value ?? 0) },
    exec: "out",
    viewModel: { kind: "text", title: "Const", body: "Number literal emitted." },
  }),
};

const constBooleanNode: NodeDefinition = {
  type: "ConstBoolean",
  version: 1,
  title: "Const Boolean",
  description: "Emit a boolean literal.",
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "boolean" },
  ],
  propsSchema: z.object({ value: z.boolean().default(false) }).strict(),
  defaultProps: { value: false },
  form: [{ key: "value", label: "Value", type: "boolean" }],
  run: (ctx) => ({
    data: { value: Boolean(ctx.props.value) },
    exec: "out",
    viewModel: { kind: "text", title: "Const", body: "Boolean literal emitted." },
  }),
};

const constJsonNode: NodeDefinition = {
  type: "ConstJson",
  version: 1,
  title: "Const JSON",
  description: "Emit a JSON literal.",
  inputs: [{ key: "in", label: "In", kind: "exec" }],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json" },
  ],
  propsSchema: z.object({ value: z.unknown() }).strict(),
  defaultProps: { value: { sample: true } },
  form: [{ key: "value", label: "Value", type: "json" }],
  run: (ctx) => ({
    data: { value: ctx.props.value },
    exec: "out",
    viewModel: { kind: "text", title: "Const", body: "JSON literal emitted." },
  }),
};

const toNumberNode: NodeDefinition = {
  type: "ToNumber",
  version: 1,
  title: "To Number",
  description: "Convert a JSON value into a number.",
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "number", label: "Number", kind: "data", dataType: "number" },
  ],
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
      exec: "out",
      viewModel: { kind: "text", title: "ToNumber", body: `Converted to ${num}.` },
    };
  },
};

const toStringNode: NodeDefinition = {
  type: "ToString",
  version: 1,
  title: "To String",
  description: "Convert a JSON value into a string.",
  inputs: [
    { key: "in", label: "In", kind: "exec" },
    { key: "value", label: "Value", kind: "data", dataType: "json", required: true },
  ],
  outputs: [
    { key: "out", label: "Out", kind: "exec" },
    { key: "text", label: "Text", kind: "data", dataType: "string" },
  ],
  propsSchema: z.object({}).strict(),
  defaultProps: {},
  form: [],
  run: (ctx) => ({
    data: { text: String(ctx.inputs.value ?? "") },
    exec: "out",
    viewModel: { kind: "text", title: "ToString", body: "Converted to string." },
  }),
};

const showTextNodeV2: NodeDefinition = {
  type: "ShowText",
  version: 2,
  title: "Show Text",
  description: "Display a message and wait for user NEXT.",
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

const waitChoiceNode: NodeDefinition = {
  type: "WaitForChoice",
  version: 1,
  title: "Wait For Choice",
  description: "Pause execution until the user selects a choice.",
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

const delayNode: NodeDefinition = {
  type: "Delay",
  version: 1,
  title: "Delay",
  description: "Pause execution for a duration before continuing.",
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

const divideNode: NodeDefinition = {
  type: "Divide",
  version: 1,
  title: "Divide",
  description: "Divide A by B. Throws error on division by zero.",
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

const subgraphNode: NodeDefinition = {
  type: "Subgraph",
  version: 1,
  title: "Subgraph",
  description: "Invoke a nested subgraph by id.",
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
  divideNode,
  subgraphNode,
];

const migrations: Record<string, Record<number, (props: Record<string, unknown>) => Record<string, unknown>>> = {
  ShowText: {
    1: (props) => ({
      title: typeof props.label === "string" ? props.label : "Message",
    }),
  },
};

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
