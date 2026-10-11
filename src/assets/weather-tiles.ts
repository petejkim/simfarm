import type {WeatherState} from '../simulation/weather';

export type WeatherPalette='normal'|'rain'|'frost';
/** Source1e50c..1e57e, VGA branch: precipitation uses frost below32F. */
export function weatherPalette(weather:Pick<WeatherState,'current'|'temperature'>):WeatherPalette{
  return weather.current>=3 ? weather.temperature<32?'frost':'rain' : 'normal';
}
// Decoded artwork cache only; no simulation state. Weak ownership releases all
// variants when their source atlas is no longer used by a loaded farm.
const variants=new WeakMap<HTMLImageElement,Record<WeatherPalette,HTMLImageElement>>();
export function registerWeatherTiles(normal:HTMLImageElement,rain:HTMLImageElement,frost:HTMLImageElement){
  variants.set(normal,{normal,rain,frost});return normal;
}
export function tilesForWeather(tiles:HTMLImageElement,weather:Pick<WeatherState,'current'|'temperature'>|undefined):HTMLImageElement{
  return weather?variants.get(tiles)?.[weatherPalette(weather)]??tiles:tiles;
}
