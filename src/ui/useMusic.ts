import {readPreferences,rememberPreference} from './preferences';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiPlayer,DEFAULT_MUSIC_VOLUME } from '../audio/midi-player';
import { loadMusic } from '../assets/game-assets';

type Playback = { status: 'idle' | 'loading' | 'playing' } | { status: 'error'; error: string };
export function useMusic() {
  const [player] = useState(() => new MidiPlayer());
  const [track, setTrack] = useState('amain'), [volume, setVolume] = useState(DEFAULT_MUSIC_VOLUME*100);
  const [playback, setPlayback] = useState<Playback>({ status: 'idle' });
  const request = useRef<AbortController | null>(null);
  const [enabled,setEnabled]=useState(()=>readPreferences().music??true);
  const current = useRef({ track: 'amain', enabled });
  const activated=useRef(false);
  const started=useRef(false);
  useEffect(() => {
    const stopOnHide = () => { activated.current = false; request.current?.abort(); player.stop(); setPlayback({ status: 'idle' }); };
    window.addEventListener('pagehide', stopOnHide);
    return () => { window.removeEventListener('pagehide', stopOnHide); request.current?.abort(); player.dispose(); };
  }, [player]);
  const play = useCallback(async (id: string): Promise<void> => {
    current.current = { track: id, enabled: true };
    setTrack(id);
    request.current?.abort(); player.stop();
    const controller = new AbortController(); request.current = controller;
    setPlayback({ status: 'loading' });
    try {
      const sequence = await loadMusic(id, controller.signal);
      if (controller.signal.aborted) return;
      await player.play(sequence, id === 'amain' ? () => {
        if (!controller.signal.aborted && current.current.enabled) void play('genfarm');
      } : undefined);
      if (!controller.signal.aborted) { started.current=true; setPlayback({ status: 'playing' }); }
    } catch (error) {
      if (!controller.signal.aborted) { player.stop(); setPlayback({ status: 'error', error: String(error) }); }
    }
  }, [player]);
  const activate=useCallback(()=>{
    if(!current.current.enabled||activated.current)return;
    activated.current=true;
    // Resume Web Audio synchronously from the gesture before fetching MIDI.
    void player.enable().then(()=>{if(activated.current&&current.current.enabled)void play(current.current.track);}).catch(error=>setPlayback({status:'error',error:String(error)}));
  },[player,play]);
  useEffect(()=>{
    window.addEventListener('pointerdown',activate);window.addEventListener('keydown',activate);
    return()=>{window.removeEventListener('pointerdown',activate);window.removeEventListener('keydown',activate);};
  },[activate]);
  function toggleTrack(id: string) {
    if (!started.current) id='amain';
    if (!current.current.enabled) { setTrack(id);current.current.track=id;toggle(); }
    else toggle();
  }
  function toggle() {
    const next=!current.current.enabled;current.current.enabled=next;setEnabled(next);rememberPreference('music',next);
    if(!next){activated.current=false;request.current?.abort();player.stop();setPlayback({status:'idle'});}
    else activate();
  }
  function selectTrack(id: string) {
    if (!started.current) id='amain';
    setTrack(id);
    current.current.track = id;
    if (current.current.enabled&&activated.current) void play(id);
  }
  // Original 0x23b22 requires music enabled and leaves an identical playing
  // sequence alone. Ref updates also deduplicate requests within one game tick.
  const requestTrack = useCallback((id: string) => {
    // Startup has priority until amain has actually begun, including asset loading.
    if (!started.current || !current.current.enabled || current.current.track === id) return;
    setTrack(id);current.current.track=id;if(activated.current)void play(id);
  }, [play]);
  function changeVolume(value: number) { setVolume(value); player.setVolume(value / 100); }
  const message = playback.status === 'playing' ? `Playing ${track} · MIDI · AIL/SimFarm`
    : playback.status === 'loading' ? `Loading ${track}…`
    : playback.status === 'error' ? `Music unavailable: ${playback.error}` : enabled?'Music enabled · starts on interaction':'Music off';
  return { enabled, toggleTrack, track, volume, playback, message, selectTrack, changeVolume, requestTrack };
}
