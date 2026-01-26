import { useEffect, useRef } from "react";
import { useMachine } from "@xstate/react";
import { studioMachine } from "./machine";
import { createEcsState, setSelection, setValidationState, syncGraphToEcs } from "./ecs";
import type { Graph } from "../engine/ir";
import type { EcsState } from "./ecs";

export const useStudio = () => {
  const [state, send] = useMachine(studioMachine);
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("studio:state", state.value);
    }
  }
  const ecsRef = useRef<EcsState | null>(null);
  if (!ecsRef.current) {
    ecsRef.current = createEcsState(state.context.graph);
  }

  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    syncGraphToEcs(ecsRef.current, state.context.graph);
  }, [state.context.graph]);

  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    setSelection(ecsRef.current, state.context.selectedNodeId);
  }, [state.context.selectedNodeId]);

  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    setValidationState(
      ecsRef.current,
      state.context.validationStatus,
      state.context.validationErrors
    );
  }, [state.context.validationStatus, state.context.validationErrors]);

  const updateGraph = (graph: Graph) => {
    send({ type: "GRAPH_UPDATED", graph });
  };

  return {
    state,
    send,
    ecs: ecsRef.current as EcsState,
    updateGraph,
  };
};
