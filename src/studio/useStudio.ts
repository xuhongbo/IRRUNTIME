// 文件说明：自动补充文件级注释，描述模块职责与用途

// 编辑器 Hook：封装状态机与 ECS 同步
import { useEffect, useRef } from "react";
import { useMachine } from "@xstate/react";
import { studioMachine } from "./machine";
import { createEcsState, setSelection, setValidationState, syncGraphToEcs } from "./ecs";
import type { Graph } from "../engine/ir";
import type { EcsState } from "./ecs";

// 使用编辑器：返回状态机、ECS 与图更新方法
export const useStudio = () => {
  const [state, send] = useMachine(studioMachine);
  if (typeof window !== "undefined") {
    const enabled = (window as unknown as { __STUDIO_DEBUG__?: boolean }).__STUDIO_DEBUG__;
    if (enabled) {
      console.info("studio:state", state.value);
    }
  }
  // ECS 状态只初始化一次
  const ecsRef = useRef<EcsState | null>(null);
  if (!ecsRef.current) {
    ecsRef.current = createEcsState(state.context.graph);
  }

  // 图变化时同步 ECS 节点实体
  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    syncGraphToEcs(ecsRef.current, state.context.graph);
  }, [state.context.graph]);

  // 选中变化时同步 ECS 选中组件
  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    setSelection(ecsRef.current, state.context.selectedNodeId);
  }, [state.context.selectedNodeId]);

  // 校验结果变化时同步 ECS 错误状态
  useEffect(() => {
    /* istanbul ignore next -- ecsRef is created on first render */
    if (!ecsRef.current) return;
    setValidationState(
      ecsRef.current,
      state.context.validationStatus,
      state.context.validationErrors
    );
  }, [state.context.validationStatus, state.context.validationErrors]);

  // 发送图更新事件
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
