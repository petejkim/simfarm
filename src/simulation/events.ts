/** Transient presentation requests, never state owners or replayed checkpoints. */
export type GameEvent = { type: 'music'; track: 'dfarm' | 'ffarm' | 'cowman' }
  | { type: 'sound'; sound: 'boos' | 'cheers' };
