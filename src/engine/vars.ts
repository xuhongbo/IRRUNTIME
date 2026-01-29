// 文件说明：自动补充文件级注释，描述模块职责与用途

// 变量命名空间
export const VAR_NAMESPACES = ["global", "scene", "temp"] as const;
export type VarNamespace = (typeof VAR_NAMESPACES)[number];

// 规范化变量名称，自动补齐命名空间
export const normalizeVarName = (name: string, fallback: VarNamespace = "global") => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(".")) return trimmed;
  return `${fallback}.${trimmed}`;
};

// 拆分变量名称为命名空间与键
export const splitVarName = (name: string) => {
  const trimmed = name.trim();
  const idx = trimmed.indexOf(".");
  if (idx <= 0) {
    return { namespace: "global" as VarNamespace, key: trimmed, full: normalizeVarName(trimmed) };
  }
  const namespace = trimmed.slice(0, idx) as VarNamespace;
  const key = trimmed.slice(idx + 1);
  return { namespace, key, full: trimmed };
};

// 判断是否包含命名空间
export const isNamespaced = (name: string) => name.trim().includes(".");
