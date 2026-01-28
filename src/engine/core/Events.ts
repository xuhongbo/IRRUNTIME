export enum EventType {
  LIFECYCLE = 'lifecycle', // OnStart, OnDestroy
  INTERACTION = 'interaction', // OnClick, OnCollision
  TIMING = 'timing',       // OnInterval, OnTimeout
  EXTERNAL = 'external',   // Webhook, API
  CUSTOM = 'custom'        // Broadcast
}

export interface GameEvent {
  type: EventType;
  name: string;
  targetId?: string; // Entity ID if applicable
  payload: Record<string, any>;
}
