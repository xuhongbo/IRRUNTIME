// 文件说明：自动补充文件级注释，描述模块职责与用途

// 变量作用域：支持父子链式查询
export class VariableScope {
  private variables: Map<string, any> = new Map();
  private parent?: VariableScope;

  constructor(parent?: VariableScope) {
    this.parent = parent;
  }

  // 获取变量值（向上查找）
  get(name: string): any {
    if (this.variables.has(name)) return this.variables.get(name);
    return this.parent ? this.parent.get(name) : undefined;
  }

  // 设置变量值：优先更新已存在的作用域
  set(name: string, value: any) {
    // Set in the scope where it already exists (upwards), or in current if not found anywhere (shadowing vs global)
    // Strategy: If it exists in current, update current.
    // If it exists in parent, update parent.
    // If nowhere, set in current.
    if (this.variables.has(name)) {
      this.variables.set(name, value);
    } else if (this.parent && this.parent.has(name)) {
      this.parent.set(name, value);
    } else {
      this.variables.set(name, value);
    }
  }
  
  // 判断变量是否存在（向上查找）
  has(name: string): boolean {
    if (this.variables.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  // 获取当前作用域与父作用域的快照
  getSnapshot(): Record<string, any> {
    const vars: Record<string, any> = {};
    if (this.parent) {
      Object.assign(vars, this.parent.getSnapshot());
    }
    this.variables.forEach((v, k) => {
      vars[k] = v;
    });
    return vars;
  }
}
