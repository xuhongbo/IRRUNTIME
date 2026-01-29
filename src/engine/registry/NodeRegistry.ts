// 文件说明：自动补充文件级注释，描述模块职责与用途

// 旧版节点注册表
import { GameNodeDefinition } from "../core/Node";

// 节点注册表类
export class NodeRegistry {
  private nodes: Map<string, GameNodeDefinition> = new Map();
  private nodesByVersion: Map<string, Map<number, GameNodeDefinition>> = new Map();

  // 注册节点定义
  register(node: GameNodeDefinition) {
    this.nodes.set(node.type, node); // 注册最新版本
    
    if (!this.nodesByVersion.has(node.type)) {
      this.nodesByVersion.set(node.type, new Map());
    }
    this.nodesByVersion.get(node.type)!.set(node.version, node);
  }

  // 获取节点定义（可指定版本）
  get(type: string, version?: number): GameNodeDefinition | undefined {
    if (version !== undefined) {
      return this.nodesByVersion.get(type)?.get(version);
    }
    return this.nodes.get(type);
  }

  // 获取全部节点定义
  getAll(): GameNodeDefinition[] {
    return Array.from(this.nodes.values());
  }
}

// 全局注册表实例
export const globalRegistry = new NodeRegistry();
