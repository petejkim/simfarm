import './style.css';
import { readScenario, terrainTile, WORLD_SIZE, type Scenario } from './formats/scenario';
import type { CropDefinition } from './formats/crop';
import type { MidiSequence } from './formats/xmidi';
import { MidiPlayer } from './audio/midi-player';

interface Catalog { crops: CropDefinition[]; music: { id: string; duration: number }[]; tileCount: number }
const app = document.querySelector<HTMLDivElement>('#app')!;
const player = new MidiPlayer();
async function response(path: string): Promise<Response> {
  const result = await fetch(`${import.meta.env.BASE_URL}assets/${path}`);
  if (!result.ok || result.headers.get('Content-Type')?.includes('text/html')) throw new Error(`Missing game asset: ${path}. Run npm run import first.`);
  return result;
}
function image(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Cannot load ${path}`));
    img.src = `${import.meta.env.BASE_URL}assets/${path}`;
  });
}
async function main(): Promise<void> {
  const [catalog, tiles] = await Promise.all([response('catalog.json').then(r => r.json()) as Promise<Catalog>, image('tiles.png')]);
  app.innerHTML = `
    <header><div><span class="eyebrow">NATIVE PRESERVATION PROJECT</span><h1>SimFarm<span>1993</span></h1></div>
      <div class="music-controls"><label>Music <select id="music"></select></label><button id="play">Play music</button><label class="volume">Volume <input id="volume" type="range" min="0" max="100" value="25"></label></div></header>
    <section class="toolbar"><div><label>Original farm <select id="scenario"></select></label><span id="map-status" role="status">Loading map…</span></div>
      <div><label>Zoom <select id="zoom"><option value="0.5">50%</option><option value="1" selected>100%</option><option value="2">200%</option></select></label><button id="center">Center map</button></div></section>
    <main><section class="map-panel"><div id="viewport" tabindex="0" aria-label="Farm map. Scroll or use arrow keys to explore."><canvas id="world" width="1536" height="1536" aria-label="Original scenario terrain"></canvas></div>
      <div class="map-footer"><span>Scroll to explore · click a tile to examine</span><span id="cell-status">96 × 96 tiles</span></div></section>
      <aside><div class="panel-heading"><span class="eyebrow">FARM REFERENCE</span><h2>Crop guide</h2></div><label class="crop-label">Choose a crop <select id="crop"></select></label><img id="crop-card" alt=""><h3 id="crop-name"></h3><p id="crop-description"></p><details><summary>Tile details</summary><pre id="tile-details">Select a tile on the map.</pre></details></aside></main>
    <footer><strong>Reconstruction in progress</strong><span>Original terrain and crop guide are available. Farming actions and simulation are still being recovered.</span><span id="audio-status" role="status">Music off</span></footer>`;
  const select = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const scenarioSelect = select<HTMLSelectElement>('#scenario'), cropSelect = select<HTMLSelectElement>('#crop');
  const musicSelect = select<HTMLSelectElement>('#music'), playButton = select<HTMLButtonElement>('#play');
  const canvas = select<HTMLCanvasElement>('#world'), viewport = select<HTMLDivElement>('#viewport');
  const context = canvas.getContext('2d')!;
  let scenario: Scenario, selection = -1, zoom = 1, loading = 0, musicGeneration = 0;
  for (let i = 0; i < 8; i++) scenarioSelect.add(new Option(`Scenario ${i + 1}`, String(i)));
  for (const crop of catalog.crops) cropSelect.add(new Option(crop.name, crop.id));
  for (const track of catalog.music) musicSelect.add(new Option(track.id, track.id));
  musicSelect.value = 'amain'; cropSelect.value = 'wheat';
  function draw(): void {
    context.imageSmoothingEnabled = false;
    for (let i = 0; i < scenario.cells.length; i++) {
      const tile = terrainTile(scenario.cells[i]);
      context.drawImage(tiles, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, i % WORLD_SIZE * 16, Math.floor(i / WORLD_SIZE) * 16, 16, 16);
    }
    if (selection >= 0) {
      context.strokeStyle = '#fff6a2'; context.lineWidth = 1;
      context.strokeRect(selection % WORLD_SIZE * 16 + 0.5, Math.floor(selection / WORLD_SIZE) * 16 + 0.5, 15, 15);
    }
  }
  function center(): void { viewport.scrollTo((canvas.clientWidth - viewport.clientWidth) / 2, (canvas.clientHeight - viewport.clientHeight) / 2); }
  async function loadScenario(): Promise<void> {
    const generation = ++loading, id = Number(scenarioSelect.value);
    select('#map-status').textContent = 'Loading map…';
    try {
      const bytes = new Uint8Array(await (await response(`raw/SCEN${id}.SSM`)).arrayBuffer());
      if (generation !== loading) return;
      scenario = readScenario(bytes); selection = -1; draw(); center();
      select('#map-status').textContent = `Scenario ${id + 1} · original terrain`;
      select('#tile-details').textContent = 'Select a tile on the map.';
      select('#cell-status').textContent = '96 × 96 tiles';
    } catch (error) { if (generation === loading) select('#map-status').textContent = String(error); }
  }
  function showCrop(): void {
    const crop = catalog.crops.find(c => c.id === cropSelect.value)!;
    select<HTMLImageElement>('#crop-card').src = `${import.meta.env.BASE_URL}assets/${crop.id}.card.png`;
    select<HTMLImageElement>('#crop-card').alt = `${crop.name}, original crop illustration`;
    select('#crop-name').textContent = crop.name;
    select('#crop-description').textContent = crop.description;
  }
  async function playMusic(): Promise<void> {
    const generation = ++musicGeneration, id = musicSelect.value;
    playButton.disabled = true;
    try {
      const sequence = await (await response(`${id}.music.json`)).json() as MidiSequence;
      if (generation !== musicGeneration) return;
      await player.play(sequence);
      if (generation !== musicGeneration) return;
      playButton.textContent = 'Stop music';
      select('#audio-status').textContent = `Playing ${id} · MIDI with temporary synth timbres`;
    } catch (error) {
      if (generation === musicGeneration) { player.stop(); playButton.textContent = 'Play music'; select('#audio-status').textContent = `Music unavailable: ${String(error)}`; }
    } finally { if (generation === musicGeneration) playButton.disabled = false; }
  }
  playButton.onclick = () => {
    if (player.playing) { musicGeneration++; player.stop(); playButton.textContent = 'Play music'; select('#audio-status').textContent = 'Music off'; }
    else void playMusic();
  };
  musicSelect.onchange = () => { if (player.playing || playButton.disabled) void playMusic(); };
  select<HTMLInputElement>('#volume').oninput = event => player.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  scenarioSelect.onchange = () => void loadScenario(); cropSelect.onchange = showCrop;
  select('#center').onclick = center;
  select<HTMLSelectElement>('#zoom').onchange = event => {
    const old = zoom; zoom = Number((event.target as HTMLSelectElement).value);
    const x = (viewport.scrollLeft + viewport.clientWidth / 2) / old, y = (viewport.scrollTop + viewport.clientHeight / 2) / old;
    canvas.style.width = `${1536 * zoom}px`; canvas.style.height = `${1536 * zoom}px`;
    viewport.scrollTo(x * zoom - viewport.clientWidth / 2, y * zoom - viewport.clientHeight / 2);
  };
  canvas.onclick = event => {
    if (!scenario) return;
    const rect = canvas.getBoundingClientRect(), x = Math.floor((event.clientX - rect.left) / (16 * zoom)), y = Math.floor((event.clientY - rect.top) / (16 * zoom));
    if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return;
    selection = y * WORLD_SIZE + x;
    const cell = scenario.cells[selection];
    select('#cell-status').textContent = `Tile ${x}, ${y} · graphic ${terrainTile(cell)}`;
    select('#tile-details').textContent = `Position: ${x}, ${y}\nTerrain: 0x${cell.terrain.toString(16).padStart(4, '0')}\nSecond word: 0x${cell.overlay.toString(16).padStart(4, '0')}\nAttribute: ${cell.attribute}`;
    draw();
  };
  viewport.onkeydown = event => {
    const offsets: Record<string, [number, number]> = { ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64] };
    if (offsets[event.key]) { event.preventDefault(); viewport.scrollBy(...offsets[event.key]); }
  };
  window.addEventListener('pagehide', () => player.stop());
  showCrop(); await loadScenario();
}
main().catch(error => {
  app.replaceChildren(); const title = document.createElement('h1'), message = document.createElement('p');
  title.textContent = 'SimFarm assets unavailable'; message.textContent = `${String(error)} Start with npm run import, then npm run dev.`;
  app.append(title, message);
});
