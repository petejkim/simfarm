/** Transient presentation requests, never state owners or replayed checkpoints. */
export type AnimalSound = 'horse1' | 'cow1' | 'cow2' | 'pig' | 'sheep1' | 'sheep2';
export type AnimalVocal = `${AnimalSound}.voc`;
export type GameSound = 'click' | 'rooster' | 'boos' | 'cheers' | 'explode' | 'bulldoze' | 'plane' | 'tornado' | 'swarm' | 'wind' | 'flood' | 'plopitem' | 'ploptool' | 'uhoh' | 'smack' | AnimalSound;
export type GameEvent = { type: 'music'; track: 'dfarm' | 'ffarm' | 'cowman' | 'alien' }
  | { type: 'sound'; sound: GameSound };
