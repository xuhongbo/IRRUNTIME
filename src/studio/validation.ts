// 文件说明：自动补充文件级注释，描述模块职责与用途

// 校验入口：使用默认注册表进行图校验
import type { Graph } from "../engine/ir";
import { registry } from "../engine/registry";
import { validateGraph } from "../engine/validator";

// 执行校验
export const validateGraphWithRegistry = (graph: Graph) => {
  return validateGraph(graph, registry);
};
