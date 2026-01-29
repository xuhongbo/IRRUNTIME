// 文件说明：自动补充文件级注释，描述模块职责与用途

// 事件类型枚举
export enum EventType {
  LIFECYCLE = 'lifecycle', // OnStart, OnDestroy
  INTERACTION = 'interaction', // OnClick, OnCollision
  TIMING = 'timing',       // OnInterval, OnTimeout
  EXTERNAL = 'external',   // Webhook, API
  CUSTOM = 'custom'        // Broadcast
}

// 事件结构
export interface GameEvent {
  type: EventType;
  name: string;
  targetId?: string; // Entity ID if applicable
  payload: Record<string, any>;
}
