export class VariableScope {
  private variables: Map<string, any> = new Map();
  private parent?: VariableScope;

  constructor(parent?: VariableScope) {
    this.parent = parent;
  }

  get(name: string): any {
    if (this.variables.has(name)) return this.variables.get(name);
    return this.parent ? this.parent.get(name) : undefined;
  }

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
  
  // Helper to check existence up the chain
  has(name: string): boolean {
    if (this.variables.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

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
