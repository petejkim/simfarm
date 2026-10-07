import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiPlayer } from '../audio/midi-player';
import { loadMusic } from '../assets/game-assets';

type Playback = { status: 'idle' | 'loading' | 'playing' } | { status: 'error'; error: string };
export function useMusic() {
  const [player] = useState(() => new MidiPlayer());
  const [track, setTrack] = useState('amain'), [volume, setVolume] = useState(25);
  const [playback, setPlayback] = useState<Playback>({ status: 'idle' });
  const request = useRef<AbortController | null>(null);
  const current = useRef({ track: 'amain', enabled: false });
  useEffect(() => {
    const stopOnHide = () => { current.current.enabled = false; request.current?.abort(); player.stop(); setPlayback({ status: 'idle' }); };
    window.addEventListener('pagehide', stopOnHide);
    return () => { window.removeEventListener('pagehide', stopOnHide); request.current?.abort(); player.dispose(); };
  }, [player]);
  const play = useCallback(async (id: string) => {
    current.current = { track: id, enabled: true };
    request.current?.abort(); player.stop();
    const controller = new AbortController(); request.current = controller;
    setPlayback({ status: 'loading' });
    try {
      const sequence = await loadMusic(id, controller.signal);
      if (controller.signal.aborted) return;
      await player.play(sequence);
      if (!controller.signal.aborted) setPlayback({ status: 'playing' });
    } catch (error) {
      if (!controller.signal.aborted) { current.current.enabled = false; player.stop(); setPlayback({ status: 'error', error: String(error) }); }
    }
  }, [player]);
  function toggle() {
    if (current.current.enabled) { current.current.enabled = false; request.current?.abort(); player.stop(); setPlayback({ status: 'idle' }); }
    else void play(track);
  }
  function selectTrack(id: string) {
    setTrack(id);
    current.current.track = id;
    if (current.current.enabled) void play(id);
  }
  // Original 0x23b22 requires music enabled and leaves an identical playing
  // sequence alone. Ref updates also deduplicate requests within one game tick.
  const requestTrack = useCallback((id: string) => {
    if (!current.current.enabled || current.current.track === id) return;
    setTrack(id); void play(id);
  }, [play]);
  function changeVolume(value: number) { setVolume(value); player.setVolume(value / 100); }
  const message = playback.status === 'playing' ? `Playing ${track} · MIDI with temporary synth timbres`
    : playback.status === 'loading' ? `Loading ${track}…`
    : playback.status === 'error' ? `Music unavailable: ${playback.error}` : 'Music off';
  return { track, volume, playback, message, toggle, selectTrack, changeVolume, requestTrack };
}
