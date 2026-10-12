import {useEffect,useState,type CSSProperties,type RefObject} from 'react';
import {assetUrl,type GameAssets} from '../assets/game-assets';
import type {GameSnapshot} from '../simulation/game';
import {weatherWindowView,WEATHER_SEASONS,WEATHER_SKIES} from '../simulation/weather-view';
import {GameWindow,useWindows} from './GameWindow';
import {SunkenInset} from './chrome/SunkenInset';
import {Sprite} from './chrome/Sprite';
import {TileSprite} from './chrome/TileSprite';

/** Original Weather window (weather.bmp) rebuilt from shared chrome on the source wallpaper tile:
 * header panels with season icons; thermometer, picture window and rain tube with HTML scales;
 * evaporation and wind-vane dials; forecast cells; caption and value insets. The instruments,
 * scenes, vane and needle are sprites; the column fills are palette-coloured spans. */
export function WeatherWindow({assets,snapshot,tiles,focusRef}:{assets:GameAssets;snapshot:GameSnapshot;tiles:HTMLImageElement;focusRef:RefObject<HTMLElement|null>}){
  const windows=useWindows(),[frame,setFrame]=useState(0);
  const view=weatherWindowView(snapshot.scenario.farm.calendar,snapshot.weather,snapshot.scenario.climate);
  useEffect(()=>{
    if(!windows.order.includes('weather')||snapshot.paused)return;
    // Browser presentation pacing only: more wind animates the original two
    // frames faster. DOS timer delays never control native game speed.
    const id=window.setInterval(()=>{if(!document.hidden)setFrame(n=>n^1);},Math.max(100,800/(1+Math.max(0,snapshot.weather.wind)/8)));
    return ()=>window.clearInterval(id);
  },[windows.order,snapshot.paused,snapshot.weather.wind]);
  const art=assets.weatherArtwork,bitmap=art.frame.src,palette=assets.catalog.palette;
  const rgb=(color:number)=>`rgb(${palette[color].join(',')})`;
  const tile=(id:number)=><TileSprite tile={id} atlas={tiles.src} masked={assets.maskedTiles.src}/>;
  const value=(id:string,text:string|number,label:string)=><output id={id} aria-label={label} title={String(text)}>{text}</output>;
  /** A source column fill: white track with the coloured level rising from the bottom. */
  const column=(className:string,height:number,color:number)=><span className={`weather-column ${className}`} style={{background:rgb(15)}}>
    <span style={{height,background:rgb(color)}}/></span>;
  const label=(text:string,style?:CSSProperties)=><span className="weather-label" style={style}>{text}</span>;
  return <GameWindow windowKey="weather" title="Weather" framed onClose={()=>{windows.close('weather');}}>
    <section ref={focusRef} tabIndex={-1} className="weather-window" aria-label="Weather conditions" style={{backgroundImage:`url("${assetUrl('weather-wallpaper.png')}")`}}>
      <div className="weather-header">
        <SunkenInset className="weather-header-panel">
          <SunkenInset className="weather-season-icon" title={WEATHER_SEASONS[view.season]}>{tile(200+view.season)}</SunkenInset>
          {value('weather-calendar',view.calendar,'Week and month')}
        </SunkenInset>
        <SunkenInset className="weather-header-panel">
          {value('weather-season-countdown',view.countdown,`${view.weeksTill} weeks till ${WEATHER_SEASONS[view.nextSeason]}`)}
          <SunkenInset className="weather-season-icon" title={WEATHER_SEASONS[view.nextSeason]}>{tile(200+view.nextSeason)}</SunkenInset>
        </SunkenInset>
      </div>
      <div className="weather-body">
        <div className="weather-left">
          <div className="weather-temperature">
            <div className="weather-readings">
              <div className="weather-reading">{label('F')}<SunkenInset className="weather-value-box">{value('weather-fahrenheit',view.fahrenheit,'Temperature Fahrenheit')}</SunkenInset></div>
              <div className="weather-reading">{label('C')}<SunkenInset className="weather-value-box">{value('weather-celsius',view.celsius,'Approximate temperature Celsius')}</SunkenInset></div>
            </div>
            <div className="weather-scale weather-scale-fahrenheit">{label('100')}{label('32',{marginTop:18})}{label('0',{marginTop:4,font:'7px/7px var(--font-ui)'})}{label('F',{marginTop:9,font:'7px/7px var(--font-ui)'})}</div>
            <span className="weather-stack weather-thermometer" role="img" aria-label="Thermometer">
              <Sprite image={bitmap} x={69} y={30} width={17} height={64}/>{column('weather-temperature-column',view.temperatureHeight,3)}
            </span>
            <div className="weather-scale">{label('40')}{label('0',{marginTop:18})}{label('C',{marginTop:19})}</div>
          </div>
          <span className="weather-stack weather-evaporation-dial" role="img" aria-label="Evaporation gauge">
            <Sprite image={bitmap} x={17} y={97} width={58} height={57}/>
            <Sprite className="weather-needle" image={assets.fieldGauges.src} x={view.evaporationFrame*48} y={0} width={48} height={24}/>
            <span className="weather-dial-marks">{label('Lo')}{label('Hi')}</span>
          </span>
          {label('Evaporation',{marginLeft:6,marginTop:6})}
        </div>
        <div className="weather-center">
          <SunkenInset className="weather-caption">{label("Today's Weather")}</SunkenInset>
          <span className="weather-stack weather-picture" role="img" aria-label="Original seasonal scene">
            <Sprite image={bitmap} x={89} y={39} width={153} height={94}/>
            <Sprite className="weather-sky" image={art.sky.src} x={view.sky*112} y={0} width={112} height={32}/>
            <Sprite className="weather-ground" image={art.ground.src} x={view.season*112} y={0} width={112} height={32}/>
          </span>
          <div className="weather-forecast" aria-hidden="true">{view.forecast.map((code,i)=><SunkenInset key={i} className="weather-forecast-cell" title={WEATHER_SKIES[code]}>{tile(204+code)}</SunkenInset>)}</div>
          <SunkenInset className="weather-caption weather-forecast-caption">{label('Five Day Forecast')}</SunkenInset>
        </div>
        <div className="weather-right">
          <div className="weather-rainfall">
            <div className="weather-scale weather-scale-rain">{label('60')}{label('40',{marginTop:8})}{label('20',{marginTop:8})}{label('0',{marginTop:10})}</div>
            <span className="weather-stack weather-rain-tube" role="img" aria-label="Rain gauge">
              <Sprite image={bitmap} x={246} y={31} width={14} height={63}/>{column('weather-rain-column',view.rainHeight,6)}
            </span>
            <div className="weather-rain-readings">
              <div className="weather-reading">{label('Avg\nRain')}<SunkenInset className="weather-rain-box">{value('weather-average-rain',view.averageRain,'Average rain')}</SunkenInset></div>
              <div className="weather-reading">{label('Rain\nto\nDate')}<SunkenInset className="weather-rain-box">{value('weather-rain',view.rain,'Rain to date')}</SunkenInset></div>
            </div>
          </div>
          <span className="weather-stack weather-vane-dial" role="img" aria-label="Wind vane">
            <Sprite image={bitmap} x={264} y={94} width={51} height={50}/>
            <Sprite className="weather-vane" image={art.vane.src} x={(frame&1)*32} y={0} width={32} height={32}/>
          </span>
          {label('Wind\nSpeed',{marginLeft:30,marginTop:6})}
        </div>
      </div>
      <div className="weather-footer">
        <SunkenInset className="weather-footer-box">{value('weather-evaporation',view.evaporation,'Evaporation indicator')}</SunkenInset>
        <SunkenInset className="weather-footer-box weather-wind-box">{value('weather-wind',`${view.wind} Mph`,'Wind speed')}</SunkenInset>
      </div>
      <p className="sale-accessible-detail" id="weather-summary">{WEATHER_SEASONS[view.season]} · {WEATHER_SKIES[snapshot.weather.current]} · {view.fahrenheit}°F · wind {view.wind} mph</p>
      <ol className="sale-accessible-detail" aria-label="Five day forecast">{view.forecast.map((sky,i)=><li key={i}>{i===0?'Today':`Day ${i+1}`}: {WEATHER_SKIES[sky]}</li>)}</ol>
    </section>
  </GameWindow>;
}
