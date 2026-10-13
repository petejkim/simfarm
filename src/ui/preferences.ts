import type {GameSimulation} from '../simulation/game';
export const FARM_OPTIONS=['autoBuySeeds','autoScroll','autoClear','autoGoto','messages','autoRent'] as const;
export type PreferenceKey=typeof FARM_OPTIONS[number]|'music'|'sound'|'buttonClicks';
export type VolumeKey='musicVolume'|'soundVolume';
export type Preferences=Partial<Record<PreferenceKey,boolean>&Record<VolumeKey,number>>;
export const PREFERENCES_KEY='simfarm.options.v1';
/** Browser defaults only; canonical farm options remain in GameSimulation. */
export function readPreferences():Preferences{
  try{
    const value:unknown=JSON.parse(localStorage.getItem(PREFERENCES_KEY)??'{}');
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const record=value as Record<string,unknown>;
    return Object.fromEntries([
      ...[...FARM_OPTIONS,'music','sound','buttonClicks'].flatMap(key=>typeof record[key]==='boolean'?[[key,record[key]]]:[]),
      // Volumes are whole percentages; anything else falls back to the default.
      ...(['musicVolume','soundVolume'] as const).flatMap(key=>Number.isInteger(record[key])&&(record[key] as number)>=0&&(record[key] as number)<=100?[[key,record[key]]]:[]),
    ]);
  }catch{return {};}
}
export function rememberPreference<K extends PreferenceKey|VolumeKey>(key:K,value:Required<Preferences>[K]):void{
  try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({...readPreferences(),[key]:value}));}catch{/* Storage may be unavailable; current-session controls still work. */}
}

export function applyPreferredOptions(simulation:Pick<GameSimulation,'dispatch'>):void{
  const preferences=readPreferences();
  for(const option of FARM_OPTIONS)if(preferences[option]!==undefined)simulation.dispatch({type:'set-option',option,enabled:preferences[option]!});
}
