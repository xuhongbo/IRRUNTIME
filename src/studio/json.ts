// 文件说明：自动补充文件级注释，描述模块职责与用途

// JSON 序列化与解析工具
import type { Graph } from "../engine/ir";

// 解析结果结构
export type JsonParseResult =
  | { ok: true; graph: Graph }
  | { ok: false; error: string };

// 解析图 JSON
export const parseGraphJson = (draft: string): JsonParseResult => {
  try {
    const parsed = JSON.parse(draft) as Graph;
    return { ok: true, graph: parsed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "JSON 无效" };
  }
};

// 序列化图结构
export const stringifyGraph = (graph: Graph) => JSON.stringify(graph, null, 2);
