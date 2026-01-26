import React from "react";
import { render } from "@testing-library/react";
import { ClassicPreset } from "rete";
import type { ReteNodeData } from "../types";
import { NodeView } from "../nodes";
import { registry } from "../../../engine/registry";

const buildNode = (options?: { withControl?: boolean; withMissingMeta?: boolean; withUndefinedPort?: boolean }) => {
  const node = new ClassicPreset.Node<ReteNodeData>("Test");
  node.id = "node-1";
  const input = new ClassicPreset.Input(new ClassicPreset.Socket("string"), "Input", false);
  input.id = "in";
  const output = new ClassicPreset.Output(new ClassicPreset.Socket("exec"), "Out", false);
  output.id = "next";
  node.addInput("in", input);
  node.addOutput("next", output);
  if (options?.withControl) {
    node.addControl("ctrl", new ClassicPreset.InputControl("text"));
  }
  if (options?.withUndefinedPort) {
    node.outputs.maybe = undefined;
    node.inputs.empty = undefined;
  }
  Object.assign(node, {
    id: "node-1",
    type: "Start",
    version: 1,
    props: {},
    pos: { x: 0, y: 0 },
    label: "Start",
    inputsMeta: options?.withMissingMeta ? [] : [{ key: "in", label: "In", kind: "exec" }],
    outputsMeta: [{ key: "next", label: "Next", kind: "exec" }],
    registry,
    nodeErrors: [],
    pinErrors: {},
    focusedPinKey: null,
    isRunning: false,
    hasBreakpoint: false,
  });
  return node;
};

describe("NodeView", () => {
  it("renders node and pins with test ids", () => {
    const node = buildNode();
    const { getByTestId } = render(
      <NodeView
        data={node}
        emit={() => {
          return;
        }}
      />
    );
    expect(getByTestId("node-node-1")).toBeInTheDocument();
    expect(getByTestId("pin-node-1-in")).toBeInTheDocument();
    expect(getByTestId("pin-node-1-next")).toBeInTheDocument();
  });

  it("renders controls and skips undefined ports", () => {
    const node = buildNode({ withControl: true, withMissingMeta: true, withUndefinedPort: true });
    const { getByTestId, getByText } = render(
      <NodeView
        data={node}
        emit={() => {
          return;
        }}
      />
    );
    expect(getByTestId("node-node-1")).toBeInTheDocument();
    expect(getByText("Start")).toBeInTheDocument();
  });

  it("renders error, running, and breakpoint states", () => {
    const node = buildNode();
    Object.assign(node, {
      nodeErrors: ["boom"],
      pinErrors: { in: ["bad"] },
      focusedPinKey: "in",
      isRunning: true,
      hasBreakpoint: true,
    });
    const { getByTestId, getByText } = render(
      <NodeView
        data={node}
        emit={() => {
          return;
        }}
      />
    );
    expect(getByTestId("node-node-1").className).toContain("error");
    expect(getByTestId("node-node-1").className).toContain("running");
    expect(getByTestId("pin-node-1-in").className).toContain("focused");
    expect(getByText("!")).toBeInTheDocument();
    expect(getByText("●")).toBeInTheDocument();
    expect(getByText("⏸")).toBeInTheDocument();
  });
});
