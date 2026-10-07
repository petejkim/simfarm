import type { Catalog } from '../assets/game-assets';
import type { useMusic } from './useMusic';

export function MusicControls({ tracks, music }: { tracks: Catalog['music']; music: ReturnType<typeof useMusic> }) {
  return <div className="music-controls">
    <label>Music <select id="music" value={music.track} onChange={e => music.selectTrack(e.target.value)}>
      {tracks.map(track => <option key={track.id} value={track.id}>{track.id}</option>)}
    </select></label>
    <button id="play" onClick={music.toggle}>
      {music.playback.status === 'playing' || music.playback.status === 'loading' ? 'Stop music' : 'Play music'}
    </button>
    <label className="volume">Volume <input id="volume" type="range" min="0" max="100" value={music.volume}
      onChange={e => music.changeVolume(Number(e.target.value))} /></label>
  </div>;
}
