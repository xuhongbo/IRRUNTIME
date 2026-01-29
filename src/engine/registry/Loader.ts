// 文件说明：自动补充文件级注释，描述模块职责与用途

// 标准节点加载入口（旧实现）
import { globalRegistry } from "./NodeRegistry";
import { OnStartNode } from "../nodes/lifecycle/OnStart";
import { LogNode } from "../nodes/actions/Log";
import { SetVarNode } from "../nodes/vars/SetVar";
import { GetVarNode } from "../nodes/vars/GetVar";
import { AddNode } from "../nodes/logic/Math";
import { IfNode } from "../nodes/logic/Branch";
import { WaitNode } from "../nodes/lifecycle/Wait";

// 注册标准节点到全局注册表
export function loadStandardNodes() {
  globalRegistry.register(OnStartNode);
  globalRegistry.register(LogNode);
  globalRegistry.register(SetVarNode);
  globalRegistry.register(GetVarNode);
  globalRegistry.register(AddNode);
  globalRegistry.register(IfNode);
  globalRegistry.register(WaitNode);
}
