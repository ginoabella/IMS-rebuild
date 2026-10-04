export type DependencyState = 'up' | 'down';
export interface LivenessResponse {
  status: 'alive';
}
export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    database: DependencyState;
    sessionRedis: DependencyState;
    realtimeRedis: DependencyState;
  };
}
