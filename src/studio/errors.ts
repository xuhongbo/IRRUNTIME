import type { ValidationError } from "../engine/validator";

export type ErrorBucket = {
  nodeErrors: string[];
  pinErrors: Record<string, string[]>;
};

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
