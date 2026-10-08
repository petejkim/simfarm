import { useCallback, useEffect, useRef, useState } from 'react';
import { PcmPlayer } from '../audio/pcm-player';
import { loadSound } from '../assets/game-assets';
import type { GameSound } from '../simulation/events';

export function useSound() {
  const [player] = useState(() => new PcmPlayer());
  const [enabled, setEnabled] = useState(false), [error, setError] = useState('');
  const active = useRef(false), request = useRef<AbortController | null>(null);
  const stop = useCallback(() => { active.current = false; request.current?.abort(); player.stop(); setEnabled(false); }, [player]);
  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); active.current = false; request.current?.abort(); player.dispose(); };
  }, [player, stop]);
  const toggle = async () => {
    if (active.current) { stop(); return; }
    active.current = true; setEnabled(true); setError('');
    try { await player.enable(); }
    catch (error) { if (active.current) { stop(); setError(String(error)); } }
  };
  const play = useCallback((id: GameSound) => {
    if (!active.current) return;
    request.current?.abort(); player.stop();
    const controller = new AbortController(); request.current = controller;
    void loadSound(id, controller.signal).then(sound => {
      if (!controller.signal.aborted && active.current) { player.play(sound); setError(''); }
    }).catch(error => { if (!controller.signal.aborted) setError(String(error)); });
  }, [player]);
  return { enabled, error, toggle, play };
}
