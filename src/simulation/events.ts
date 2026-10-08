/** Transient presentation requests, never state owners or replayed checkpoints. */
export type AnimalSound = 'horse1' | 'cow1' | 'cow2' | 'pig' | 'sheep1' | 'sheep2';
export type AnimalVocal = `${AnimalSound}.voc`;
export type GameSound = 'boos' | 'cheers' | 'explode' | 'bulldoze' | 'plane' | 'tornado' | 'swarm' | 'wind' | 'flood' | 'plopitem' | 'ploptool' | 'uhoh' | AnimalSound;
export type GameEvent = { type: 'music'; track: 'dfarm' | 'ffarm' | 'cowman' }
  | { type: 'sound'; sound: GameSound };
