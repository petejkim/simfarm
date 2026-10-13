import {readPreferences,rememberPreference} from './preferences';
import { ACTIVATION_EVENTS } from '../audio/user-activation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PcmPlayer } from '../audio/pcm-player';
import { loadSound } from '../assets/game-assets';
import type { GameSound } from '../simulation/events';
import type { PcmSound } from '../formats/voc';

export function useSound() {
  const [player] = useState(() => new PcmPlayer());
  const [clickPlayer] = useState(() => new PcmPlayer());
  const clickSample=useRef<PcmSound|null>(null), clickRequest=useRef<AbortController|null>(null);
  const [enabled, setEnabled] = useState(()=>readPreferences().sound??true), [error, setError] = useState('');
  const [buttonClicks,setButtonClicks]=useState(()=>readPreferences().buttonClicks??true);
  const clicksActive=useRef(buttonClicks);
  const [volume,setVolume]=useState(()=>readPreferences().soundVolume??100);
  useEffect(()=>{player.setVolume(volume/100);clickPlayer.setVolume(volume/100);},[player,clickPlayer]); // Apply the remembered volume once.
  const active = useRef(enabled), activated=useRef(false), flightRunning = useRef(false), planeFailed = useRef(false);
  // Decoded samples, kept like the original's sample cache (0x23d72 resolves/caches before playing). Refetching on
  // every request delayed rapid repeats unevenly and dropped those whose load the next request aborted.
  const samples = useRef(new Map<GameSound, PcmSound>());
  // In-flight loads by sound; effects overlap, so a new request no longer cancels another sound's load.
  const requests = useRef(new Map<GameSound, AbortController>());
  const abortLoads = useCallback(() => { for (const controller of requests.current.values()) controller.abort(); requests.current.clear(); }, []);
  const stop = useCallback(() => {
    active.current = false; activated.current=false; abortLoads();
    player.stop(); clickPlayer.stop(); clickRequest.current?.abort(); planeFailed.current = false; setEnabled(false);
  }, [player,clickPlayer,abortLoads]);
  // Presentation lifetime only. Flight rules and timing remain in GameSimulation.
  const setFlightRunning = useCallback((running: boolean) => {
    flightRunning.current = running; planeFailed.current = false;
    if (!running) {
      requests.current.get('plane')?.abort(); requests.current.delete('plane');
      const plane = samples.current.get('plane'); if (plane) player.stop(plane);
    }
  }, [player]);
  useEffect(() => {
    active.current=enabled; // Restore intent after React's development effect cleanup.
    const suspend=()=>{activated.current=false;abortLoads();clickRequest.current?.abort();player.stop();clickPlayer.stop();};
    window.addEventListener('pagehide', suspend);
    return () => { window.removeEventListener('pagehide', suspend); active.current = false; abortLoads(); clickRequest.current?.abort(); player.dispose(); clickPlayer.dispose(); };
  }, [player, clickPlayer, stop, abortLoads]);
  const activate=useCallback(()=>{
    if(!active.current)return;
    // Re-unlock synchronously on every activation event until both contexts run (mobile gesture rules, interruptions).
    if(!player.running)player.unlock();if(!clickPlayer.running)clickPlayer.unlock();
    if(activated.current)return;
    activated.current=true;void Promise.all([player.enable(),clickPlayer.enable()]).catch(error=>{activated.current=false;setError(String(error));});
  },[player,clickPlayer]);
  useEffect(()=>{
    for(const type of ACTIVATION_EVENTS)window.addEventListener(type,activate,{capture:true});
    return()=>{for(const type of ACTIVATION_EVENTS)window.removeEventListener(type,activate,{capture:true});};
  },[activate]);
  const toggle = async () => {
    if (active.current) { rememberPreference('sound',false);stop(); return; }
    rememberPreference('sound',true);active.current = true;activated.current=true;setEnabled(true);setError('');
    try { await Promise.all([player.enable(),clickPlayer.enable()]); }
    catch (error) { if (active.current) { stop(); setError(String(error)); } }
  };
  const play = useCallback((id: GameSound) => {
    if (!active.current||!activated.current) return;
    // Source0x23d72 skips status2. Engine requests wait for the plane sample/load to finish, then replay on a later
    // flight frame, never restarting each frame. Other effects overlap (native enhancement; the original had one voice).
    const cached = samples.current.get(id);
    if (id === 'plane' && (!flightRunning.current || requests.current.has(id) || (cached && player.isPlaying(cached)) || planeFailed.current)) return;
    if (cached) { player.play(cached); return; }
    if (requests.current.has(id)) return; // first load still in flight
    const controller = new AbortController(); requests.current.set(id, controller);
    void loadSound(id, controller.signal).then(sound => {
      if (!controller.signal.aborted && active.current) {
        samples.current.set(id, sound);
        player.play(sound); setError('');
      }
    }).catch(error => {
      if (!controller.signal.aborted) { if (id === 'plane') planeFailed.current = true; setError(String(error)); }
    }).finally(() => { if (requests.current.get(id) === controller) requests.current.delete(id); });
  }, [player]);
  // UI feedback has its own PCM voice so a button never cancels a disaster,
  // transaction or flight effect. Cache the original click sample after loading.
  const toggleButtonClicks=useCallback(()=>{
    const next=!clicksActive.current;clicksActive.current=next;setButtonClicks(next);rememberPreference('buttonClicks',next);
    if(!next){clickRequest.current?.abort();clickPlayer.stop();}
  },[clickPlayer]);
  const click=useCallback(()=>{
    if(!active.current||!activated.current||!clicksActive.current)return;
    if(clickSample.current){clickPlayer.play(clickSample.current);return;}
    clickRequest.current?.abort();const controller=new AbortController();clickRequest.current=controller;
    void loadSound('click',controller.signal).then(sample=>{
      if(controller.signal.aborted||!active.current||!clicksActive.current)return;
      clickSample.current=sample;clickPlayer.play(sample);
    }).catch(error=>{if(!controller.signal.aborted)setError(String(error));})
      .finally(()=>{if(clickRequest.current===controller)clickRequest.current=null;});
  },[clickPlayer]);
  const changeVolume=useCallback((value:number)=>{
    setVolume(value);player.setVolume(value/100);clickPlayer.setVolume(value/100);rememberPreference('soundVolume',value);
  },[player,clickPlayer]);
  return { enabled, volume, changeVolume, buttonClicks, toggleButtonClicks, error, toggle, play, click, setFlightRunning };
}
