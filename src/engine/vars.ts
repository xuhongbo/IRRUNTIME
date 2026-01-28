export const VAR_NAMESPACES = ["global", "scene", "temp"] as const;
export type VarNamespace = (typeof VAR_NAMESPACES)[number];

export const normalizeVarName = (name: string, fallback: VarNamespace = "global") => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(".")) return trimmed;
  return `${fallback}.${trimmed}`;
};

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

export const isNamespaced = (name: string) => name.trim().includes(".");
