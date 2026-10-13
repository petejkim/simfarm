import type { Catalog } from '../assets/game-assets';
import type { useMusic } from './useMusic';
import type { useSound } from './useSound';

export function MusicControls({ tracks, music, sound }: { tracks: Catalog['music']; music: ReturnType<typeof useMusic>; sound: ReturnType<typeof useSound> }) {
  return <div className="music-controls">
    <label className="native-row"><span className="native-label">Music</span><select id="music" className="chrome-select" value={music.track} onChange={e => music.selectTrack(e.target.value)}>
      {tracks.map(track => <option key={track.id} value={track.id}>{track.id}</option>)}
    </select></label>
    <label className="native-row volume"><span className="native-label">Music volume</span><input id="volume" className="chrome-range" type="range" min="0" max="100" value={music.volume}
      onChange={e => music.changeVolume(Number(e.target.value))} /></label>
    <label className="native-row volume"><span className="native-label">Sound volume</span><input id="sound-volume" className="chrome-range" type="range" min="0" max="100" value={sound.volume}
      onChange={e => sound.changeVolume(Number(e.target.value))} /></label>
  </div>;
}
