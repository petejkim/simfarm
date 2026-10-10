import type { FarmCalendar } from './calendar';
import type { WeatherState } from './weather';
import type { ClimateTables } from '../formats/weather';

const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const WEATHER_SKIES=['Clear','Partly cloudy','Cloudy','Rain','Snow'] as const;
export const WEATHER_SEASONS=['Winter','Spring','Summer','Fall'] as const;
/** Read-only display arithmetic from1dc54..1e14c. Retained source quirks are
 * documented in SF-166; unbounded graphical coordinates are clipped natively. */
export function weatherWindowView(calendar:FarmCalendar,weather:WeatherState,climate:ClimateTables){
  const week=calendar.month*4+calendar.week;
  const weeksTill=week>=45?57-week:week<=10?10-week:week<23?23-week:week<34?34-week:45-week;
  // Original tests the selected precipitation year but adds the first year's value.
  let sum=0;for(let i=0;i<48;i++)if(climate.precipitation[weather.precipitationYear*48+i]>0)sum=(sum+climate.precipitation[i])&65535;
  const rain=(weather.precipitationDays<<16>>16)>>2;
  const temperature=weather.displayTemperature,evaporationBand=Math.max(0,Math.min(3,temperature>>5));
  return {
    calendar:`Week ${calendar.week+1} of ${months[calendar.month]}`,
    countdown:`${weeksTill} ${weeksTill===1?'Week':'Weeks'} Till`,weeksTill,
    season:calendar.season,nextSeason:(calendar.season+1)&3,
    fahrenheit:temperature,celsius:(temperature-32)>>1,averageRain:sum>>>2,rain,wind:weather.wind,
    temperatureHeight:Math.max(0,Math.min(44,Math.trunc(temperature/3))),rainHeight:Math.max(0,Math.min(55,rain)),
    sky:weather.current===4?3:weather.current,
    forecast:[...weather.forecast,...weather.nextForecast].slice(calendar.day,calendar.day+5),
    evaporationFrame:15+evaporationBand,evaporation:['Slow','Slow','Average','Fast'][evaporationBand],
  };
}
export type WeatherWindowView=ReturnType<typeof weatherWindowView>;
