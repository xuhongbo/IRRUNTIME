import React from "react";
import { render } from "@testing-library/react";
import { CanvasOnly } from "../CanvasOnly";
import { sampleGraph } from "../../mock/graph";
import { registry } from "../../engine/registry";

jest.mock("../../studio/rete/ReteCanvas", () => ({
  ReteCanvas: () => <div data-testid="canvas-root" />,
}));

describe("CanvasOnly", () => {
  it("renders canvas-only root and canvas", () => {
    const { getByTestId } = render(
      <CanvasOnly
        graph={sampleGraph}
        registry={registry}
        selectedNodeId={sampleGraph.entryNodeId}
        focusedPin={null}
        validationErrors={[]}
        runningNodeId={null}
        breakpoints={[]}
        onSelectNode={() => null}
        onCommand={() => null}
      />
    );
    expect(getByTestId("canvas-only-root")).toBeInTheDocument();
    expect(getByTestId("canvas-root")).toBeInTheDocument();
  });
});
