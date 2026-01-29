// 文件说明：自动补充文件级注释，描述模块职责与用途

// 校验错误聚合：按节点与端口分组
import type { ValidationError } from "../engine/validator";

// 错误桶结构
export type ErrorBucket = {
  nodeErrors: string[];
  pinErrors: Record<string, string[]>;
};

// 构建错误映射
export const buildErrorMap = (errors: ValidationError[]) => {
  const map = new Map<string, ErrorBucket>();
  for (const error of errors) {
    if (!error.nodeId) continue;
    const bucket = map.get(error.nodeId) ?? { nodeErrors: [], pinErrors: {} };
    if (error.pinId) {
      bucket.pinErrors[error.pinId] = [...(bucket.pinErrors[error.pinId] ?? []), error.message];
    } else {
      bucket.nodeErrors = [...bucket.nodeErrors, error.message];
    }
    map.set(error.nodeId, bucket);
  }
  return map;
};
