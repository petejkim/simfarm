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
  const active = useRef(enabled), activated=useRef(false), flightRunning = useRef(false), planeFailed = useRef(false);
  const planeSample = useRef<PcmSound | null>(null), playing = useRef<GameSound | null>(null);
  const request = useRef<{ id: GameSound; controller: AbortController } | null>(null);
  const stop = useCallback(() => {
    active.current = false; activated.current=false; request.current?.controller.abort(); request.current = null;
    player.stop(); clickPlayer.stop(); clickRequest.current?.abort(); playing.current = null; planeFailed.current = false; setEnabled(false);
  }, [player,clickPlayer]);
  // Presentation lifetime only. Flight rules and timing remain in GameSimulation.
  const setFlightRunning = useCallback((running: boolean) => {
    flightRunning.current = running; planeFailed.current = false;
    if (!running) {
      if (request.current?.id === 'plane') { request.current.controller.abort(); request.current = null; }
      if (playing.current === 'plane') { player.stop(); playing.current = null; }
    }
  }, [player]);
  useEffect(() => {
    active.current=enabled; // Restore intent after React's development effect cleanup.
    const suspend=()=>{activated.current=false;request.current?.controller.abort();clickRequest.current?.abort();player.stop();clickPlayer.stop();};
    window.addEventListener('pagehide', suspend);
    return () => { window.removeEventListener('pagehide', suspend); active.current = false; request.current?.controller.abort(); clickRequest.current?.abort(); player.dispose(); clickPlayer.dispose(); };
  }, [player, clickPlayer, stop]);
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
    // Source0x23d72 skips status2. Native engine requests wait for the current
    // sample/load to finish, then replay on a later flight frame, never restarting each frame.
    if (id === 'plane' && (!flightRunning.current || request.current || player.playing || planeFailed.current)) return;
    request.current?.controller.abort(); player.stop();
    if (id === 'plane' && planeSample.current) { player.play(planeSample.current); playing.current = id; return; }
    const controller = new AbortController(); request.current = { id, controller };
    void loadSound(id, controller.signal).then(sound => {
      if (!controller.signal.aborted && active.current) {
        if (id === 'plane') planeSample.current = sound;
        player.play(sound); playing.current = id; setError('');
      }
    }).catch(error => {
      if (!controller.signal.aborted) { if (id === 'plane') planeFailed.current = true; setError(String(error)); }
    }).finally(() => { if (request.current?.controller === controller) request.current = null; });
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
  return { enabled, buttonClicks, toggleButtonClicks, error, toggle, play, click, setFlightRunning };
}
