import { useEffect, useRef, useState } from 'react';
import { MidiPlayer } from '../audio/midi-player';
import { loadMusic } from '../assets/game-assets';

type Playback = { status: 'idle' | 'loading' | 'playing' } | { status: 'error'; error: string };
export function useMusic() {
  const [player] = useState(() => new MidiPlayer());
  const [track, setTrack] = useState('amain'), [volume, setVolume] = useState(25);
  const [playback, setPlayback] = useState<Playback>({ status: 'idle' });
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const stopOnHide = () => { request.current?.abort(); player.stop(); setPlayback({ status: 'idle' }); };
    window.addEventListener('pagehide', stopOnHide);
    return () => { window.removeEventListener('pagehide', stopOnHide); request.current?.abort(); player.dispose(); };
  }, [player]);
  async function play(id: string) {
    request.current?.abort(); player.stop();
    const controller = new AbortController(); request.current = controller;
    setPlayback({ status: 'loading' });
    try {
      const sequence = await loadMusic(id, controller.signal);
      if (controller.signal.aborted) return;
      await player.play(sequence);
      if (!controller.signal.aborted) setPlayback({ status: 'playing' });
    } catch (error) {
      if (!controller.signal.aborted) { player.stop(); setPlayback({ status: 'error', error: String(error) }); }
    }
  }
  function toggle() {
    if (playback.status === 'playing') { request.current?.abort(); player.stop(); setPlayback({ status: 'idle' }); }
    else void play(track);
  }
  function selectTrack(id: string) {
    setTrack(id);
    if (playback.status === 'playing' || playback.status === 'loading') void play(id);
  }
  function changeVolume(value: number) { setVolume(value); player.setVolume(value / 100); }
  const message = playback.status === 'playing' ? `Playing ${track} · MIDI with temporary synth timbres`
    : playback.status === 'loading' ? `Loading ${track}…`
    : playback.status === 'error' ? `Music unavailable: ${playback.error}` : 'Music off';
  return { track, volume, playback, message, toggle, selectTrack, changeVolume };
}
