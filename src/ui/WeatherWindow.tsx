import {useEffect,useRef,useState,type RefObject} from 'react';
import type {GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import type {GameEvent} from '../simulation/events';
import {weatherWindowView,WEATHER_SEASONS,WEATHER_SKIES} from '../simulation/weather-view';
import {WEATHER_LABELS} from '../formats/weather-window';
import {drawWeatherPreview} from '../render/weather-preview';
import {GameWindow,useWindows} from './GameWindow';

export function WeatherWindow({assets,snapshot,tiles,focusRef,onEvent}:{assets:GameAssets;snapshot:GameSnapshot;tiles:CanvasImageSource;focusRef:RefObject<HTMLElement|null>;onEvent:(event:GameEvent)=>void}){
  const windows=useWindows(),canvas=useRef<HTMLCanvasElement>(null),[frame,setFrame]=useState(0);
  const view=weatherWindowView(snapshot.scenario.farm.calendar,snapshot.weather,snapshot.scenario.climate);
  useEffect(()=>{
    if(!windows.order.includes('weather')||snapshot.paused)return;
    // Browser presentation pacing only: more wind animates the original two
    // frames faster. DOS timer delays never control native game speed.
    const id=window.setInterval(()=>{if(!document.hidden)setFrame(n=>n^1);},Math.max(100,800/(1+Math.max(0,snapshot.weather.wind)/8)));
    return ()=>window.clearInterval(id);
  },[windows.order,snapshot.paused,snapshot.weather.wind]);
  useEffect(()=>{if(canvas.current)drawWeatherPreview(canvas.current.getContext('2d')!,assets.weatherArtwork,tiles,assets.fieldGauges,assets.catalog.palette,view,frame);},[assets,tiles,snapshot,frame]);
  const value=(id:string,x:number,y:number,width:number,text:string|number,label:string)=><output id={id} aria-label={label} title={String(text)}
    style={{left:x,top:y,width,fontSize:Math.min(10,width/(String(text).length*.62))}}>{text}</output>;
  return <GameWindow windowKey="weather" title="Weather" onClose={()=>{onEvent({type:'sound',sound:'click'});windows.close('weather');}}>
    <section ref={focusRef} tabIndex={-1} className="weather-window" aria-label="Weather conditions">
      <img src={assets.weatherArtwork.frame.src} width={336} height={192} alt="" draggable={false}/>
      <canvas ref={canvas} width={336} height={192} className="weather-preview" aria-label="Original seasonal scene, gauges and forecast illustrations"/>
      {WEATHER_LABELS.map((l,i)=><span key={i} className="weather-label" style={{left:l.x,top:l.y,width:l.width,height:l.height,fontSize:l.height<=7?7:9,lineHeight:`${Math.min(9,l.height)}px`}}>{l.text}</span>)}
      {value('weather-calendar',40,10,120,view.calendar,'Week and month')}
      {value('weather-season-countdown',184,10,112,view.countdown,`${view.weeksTill} weeks till ${WEATHER_SEASONS[view.nextSeason]}`)}
      {value('weather-fahrenheit',24,48,24,view.fahrenheit,'Temperature Fahrenheit')}
      {value('weather-celsius',24,64,24,view.celsius,'Approximate temperature Celsius')}
      {value('weather-average-rain',304,48,20,view.averageRain,'Average rain')}
      {value('weather-rain',304,80,20,view.rain,'Rain to date')}
      {value('weather-wind',264,174,56,`${view.wind} Mph`,'Wind speed')}
      {value('weather-evaporation',16,174,70,view.evaporation,'Evaporation indicator')}
      <p className="sale-accessible-detail" id="weather-summary">{WEATHER_SEASONS[view.season]} · {WEATHER_SKIES[snapshot.weather.current]} · {view.fahrenheit}°F · wind {view.wind} mph</p>
      <ol className="sale-accessible-detail" aria-label="Five day forecast">{view.forecast.map((sky,i)=><li key={i}>{i===0?'Today':`Day ${i+1}`}: {WEATHER_SKIES[sky]}</li>)}</ol>
    </section>
  </GameWindow>;
}
