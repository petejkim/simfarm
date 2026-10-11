import type {GameSimulation} from '../simulation/game';
export const FARM_OPTIONS=['autoBuySeeds','autoScroll','autoClear','autoGoto','messages','autoRent'] as const;
export type PreferenceKey=typeof FARM_OPTIONS[number]|'music'|'sound';
export type Preferences=Partial<Record<PreferenceKey,boolean>>;
export const PREFERENCES_KEY='simfarm.options.v1';
/** Browser defaults only; canonical farm options remain in GameSimulation. */
export function readPreferences():Preferences{
  try{
    const value:unknown=JSON.parse(localStorage.getItem(PREFERENCES_KEY)??'{}');
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    return Object.fromEntries([...FARM_OPTIONS,'music','sound'].flatMap(key=>typeof (value as Record<string,unknown>)[key]==='boolean'?[[key,(value as Record<string,boolean>)[key]]]:[]));
  }catch{return {};}
}
export function rememberPreference(key:PreferenceKey,value:boolean):void{
  try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({...readPreferences(),[key]:value}));}catch{/* Storage may be unavailable; current-session controls still work. */}
}

export function applyPreferredOptions(simulation:Pick<GameSimulation,'dispatch'>):void{
  const preferences=readPreferences();
  for(const option of FARM_OPTIONS)if(preferences[option]!==undefined)simulation.dispatch({type:'set-option',option,enabled:preferences[option]!});
}
