import { globalRegistry } from "./NodeRegistry";
import { OnStartNode } from "../nodes/lifecycle/OnStart";
import { LogNode } from "../nodes/actions/Log";
import { SetVarNode } from "../nodes/vars/SetVar";
import { GetVarNode } from "../nodes/vars/GetVar";
import { AddNode } from "../nodes/logic/Math";
import { IfNode } from "../nodes/logic/Branch";
import { WaitNode } from "../nodes/lifecycle/Wait";

export function loadStandardNodes() {
  globalRegistry.register(OnStartNode);
  globalRegistry.register(LogNode);
  globalRegistry.register(SetVarNode);
  globalRegistry.register(GetVarNode);
  globalRegistry.register(AddNode);
  globalRegistry.register(IfNode);
  globalRegistry.register(WaitNode);
}