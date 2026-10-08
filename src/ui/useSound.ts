import { useCallback, useEffect, useRef, useState } from 'react';
import { PcmPlayer } from '../audio/pcm-player';
import { loadSound } from '../assets/game-assets';
import type { GameSound } from '../simulation/events';
import type { PcmSound } from '../formats/voc';

export function useSound() {
  const [player] = useState(() => new PcmPlayer());
  const [enabled, setEnabled] = useState(false), [error, setError] = useState('');
  const active = useRef(false), flightRunning = useRef(false), planeFailed = useRef(false);
  const planeSample = useRef<PcmSound | null>(null), playing = useRef<GameSound | null>(null);
  const request = useRef<{ id: GameSound; controller: AbortController } | null>(null);
  const stop = useCallback(() => {
    active.current = false; request.current?.controller.abort(); request.current = null;
    player.stop(); playing.current = null; planeFailed.current = false; setEnabled(false);
  }, [player]);
  // Presentation lifetime only. Flight rules and timing remain in GameSimulation.
  const setFlightRunning = useCallback((running: boolean) => {
    flightRunning.current = running; planeFailed.current = false;
    if (!running) {
      if (request.current?.id === 'plane') { request.current.controller.abort(); request.current = null; }
      if (playing.current === 'plane') { player.stop(); playing.current = null; }
    }
  }, [player]);
  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); active.current = false; request.current?.controller.abort(); player.dispose(); };
  }, [player, stop]);
  const toggle = async () => {
    if (active.current) { stop(); return; }
    active.current = true; setEnabled(true); setError('');
    try { await player.enable(); }
    catch (error) { if (active.current) { stop(); setError(String(error)); } }
  };
  const play = useCallback((id: GameSound) => {
    if (!active.current) return;
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
  return { enabled, error, toggle, play, setFlightRunning };
}
