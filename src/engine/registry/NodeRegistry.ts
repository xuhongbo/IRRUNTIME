import { GameNodeDefinition } from "../core/Node";

export class NodeRegistry {
  private nodes: Map<string, GameNodeDefinition> = new Map();
  private nodesByVersion: Map<string, Map<number, GameNodeDefinition>> = new Map();

  register(node: GameNodeDefinition) {
    this.nodes.set(node.type, node); // Register latest by default key
    
    if (!this.nodesByVersion.has(node.type)) {
      this.nodesByVersion.set(node.type, new Map());
    }
    this.nodesByVersion.get(node.type)!.set(node.version, node);
  }

  get(type: string, version?: number): GameNodeDefinition | undefined {
    if (version !== undefined) {
      return this.nodesByVersion.get(type)?.get(version);
    }
    return this.nodes.get(type);
  }

  getAll(): GameNodeDefinition[] {
    return Array.from(this.nodes.values());
  }
}

export const globalRegistry = new NodeRegistry();
