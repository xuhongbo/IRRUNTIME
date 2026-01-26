jest.mock("bitecs");
import { renderHook, act } from "@testing-library/react";
import { useStudio } from "../useStudio";
import type { Graph } from "../../engine/ir";

describe("useStudio", () => {
  it("exposes state and updates graph", () => {
    const { result } = renderHook(() => useStudio());
    const initialId = result.current.state.context.graph.id;
    const nextGraph: Graph = { ...result.current.state.context.graph, id: "changed" };
    act(() => {
      result.current.updateGraph(nextGraph);
    });
    expect(result.current.state.context.graph.id).toBe("changed");
    expect(result.current.state.context.graph.id).not.toBe(initialId);
  });

  it("logs state when debug flag is enabled", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__ = true;
    renderHook(() => useStudio());
    expect(infoSpy).toHaveBeenCalledWith("studio:state", "editing");
    delete (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    infoSpy.mockRestore();
  });
});
