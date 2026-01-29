// 文件说明：自动补充文件级注释，描述模块职责与用途

import React from "react";
import { render, fireEvent } from "@testing-library/react";
import type { Graph } from "../../engine/ir";
import { registry } from "../../engine/registry";
import { Inspector } from "../Inspector";

const graph: Graph = {
  id: "g",
  version: 1,
  entryNodeId: "show",
  nodes: [
    { id: "show", type: "ShowText", version: 2, props: { title: "Old" }, pos: { x: 0, y: 0 } },
  ],
  edges: [],
};

describe("Inspector", () => {
  it("applies edited props via callback", () => {
    const onApplyProps = jest.fn();
    const onDeleteNode = jest.fn();
    const onToggleBreakpoint = jest.fn();
    const { getByLabelText, getByRole } = render(
      <Inspector
        graph={graph}
        nodeId="show"
        registry={registry}
        lastNodeIO={{}}
        validationErrors={[]}
        onApplyProps={onApplyProps}
        onDeleteNode={onDeleteNode}
        hasBreakpoint={false}
        onToggleBreakpoint={onToggleBreakpoint}
      />
    );

    const input = getByLabelText("标题") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.click(getByRole("button", { name: "应用更改" }));

    expect(onApplyProps).toHaveBeenCalledTimes(1);
    expect(onApplyProps).toHaveBeenCalledWith("show", { title: "New Title" });
  });
});
