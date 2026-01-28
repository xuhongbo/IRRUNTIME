import type { Graph } from "../engine/ir";

export const sampleGraph: Graph = {
  id: "main",
  version: 1,
  entryNodeId: "start",
  contract: {
    inputs: [],
    outputs: [],
  },
  presets: [],
  nodes: [
    { id: "start", type: "Start", version: 1, props: {}, pos: { x: 0, y: 0 } },
    {
      id: "const-condition",
      type: "ConstBoolean",
      version: 1,
      props: { value: true },
      pos: { x: 240, y: 0 },
    },
    { id: "if-1", type: "If", version: 1, props: {}, pos: { x: 480, y: 0 } },
    {
      id: "const-then",
      type: "ConstString",
      version: 1,
      props: { value: "你选择了分支 A" },
      pos: { x: 720, y: -120 },
    },
    {
      id: "show-then",
      type: "ShowText",
      version: 2,
      props: { title: "分支 A" },
      pos: { x: 960, y: -120 },
    },
    { id: "end-then", type: "End", version: 1, props: {}, pos: { x: 1200, y: -120 } },
    {
      id: "const-else",
      type: "ConstString",
      version: 1,
      props: { value: "你选择了分支 B" },
      pos: { x: 720, y: 120 },
    },
    {
      id: "show-else",
      type: "ShowText",
      version: 2,
      props: { title: "分支 B" },
      pos: { x: 960, y: 120 },
    },
    { id: "end-else", type: "End", version: 1, props: {}, pos: { x: 1200, y: 120 } },
  ],
  edges: [
    { id: "e1", from: { nodeId: "start", pinKey: "next" }, to: { nodeId: "if-1", pinKey: "in" } },
    { id: "d1", from: { nodeId: "const-condition", pinKey: "value" }, to: { nodeId: "if-1", pinKey: "condition" } },
    { id: "e2", from: { nodeId: "if-1", pinKey: "then" }, to: { nodeId: "show-then", pinKey: "in" } },
    { id: "d2", from: { nodeId: "const-then", pinKey: "value" }, to: { nodeId: "show-then", pinKey: "text" } },
    { id: "e3", from: { nodeId: "show-then", pinKey: "out" }, to: { nodeId: "end-then", pinKey: "in" } },
    { id: "e4", from: { nodeId: "if-1", pinKey: "else" }, to: { nodeId: "show-else", pinKey: "in" } },
    { id: "d3", from: { nodeId: "const-else", pinKey: "value" }, to: { nodeId: "show-else", pinKey: "text" } },
    { id: "e5", from: { nodeId: "show-else", pinKey: "out" }, to: { nodeId: "end-else", pinKey: "in" } },
  ],
};
