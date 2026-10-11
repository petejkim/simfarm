/** Transient presentation requests, never state owners or replayed checkpoints. */
export type AnimalSound = 'horse1' | 'cow1' | 'cow2' | 'pig' | 'sheep1' | 'sheep2';
export type AnimalVocal = `${AnimalSound}.voc`;
export type FinanceNoticeId = 36 | 39 | 159 | 161 | 162 | 163 | 165 | 166 | 168 | 169 | 170;
export type DisasterNoticeId = 'frost' | 'wind' | 'crop-circles' | 'toxic-land' | 'tornado' | 'drought' | 'flood' | 'swarm' | 'wind-ended' | 'tornado-ended' | 'drought-ended' | 'flood-ended';
export type GameSound = 'click' | 'rooster' | 'boos' | 'cheers' | 'explode' | 'bulldoze' | 'plane' | 'tornado' | 'swarm' | 'wind' | 'flood' | 'plopitem' | 'ploptool' | 'uhoh' | 'smack' | AnimalSound;
export type GameEvent = { type: 'music'; track: 'dfarm' | 'ffarm' | 'cowman' | 'alien' }
  | { type: 'sound'; sound: GameSound }
  | { type: 'field-notice'; id: 'fixed-harvest-week' }
  | { type: 'finance-notice'; id: FinanceNoticeId }
  | { type: 'disaster-notice'; id: DisasterNoticeId }
  | { type: 'map-focus'; x: number; y: number };
