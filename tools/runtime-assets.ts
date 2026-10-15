import type { GameSound } from '../src/simulation/events.ts';

// Keep this exhaustive: adding a sound request must also make its source sample public.
const sounds: Record<GameSound, true> = {
  click: true, rooster: true, boos: true, cheers: true, explode: true, bulldoze: true,
  plane: true, tornado: true, swarm: true, wind: true, flood: true, plopitem: true,
  ploptool: true, uhoh: true, smack: true, horse1: true, cow1: true, cow2: true,
  pig: true, sheep1: true, sheep2: true,
};

/** Original files still decoded by the browser, rather than during import. */
export const runtimeRawFiles = new Set([
  'creditz.txt', 'townly0.cmp', 'itemtext.dat', 'scenario.odt', 'scenario.int',
  'scenario.pal', 'far_mapc.mbm',
  ...Array.from({ length: 8 }, (_, id) => `SCEN${id}.SSM`),
  ...Object.keys(sounds).map(id => `${id}.voc`),
]);

/** Every public asset requested by the app, HTML or home-screen manifest. */
export const runtimePublicFiles = new Set([
  'manifest.webmanifest',
  ...[
    'about-logo.png', 'about-window.png', 'aircraft-window.png', 'airplane.sprites.png', 'alien.mid',
    'amain.mid', 'app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png',
    'apshadow.sprites.png', 'balance-window.png', 'buy-cards.png', 'buy-catalog.json',
    'buy-window.png', 'carnival.mid', 'catalog.json', 'control-bar.png', 'cowman.mid',
    'crop-cards.png', 'cropdust.sprites.png', 'defworld.png', 'dfarm.mid', 'edit-bulldoze.png',
    'edit-buy.png', 'edit-palette.png', 'edit-spray.png', 'edit-view.png', 'examine.json',
    'expert-launcher.png', 'expert-portrait.png', 'favicon-16.png', 'favicon-32.png', 'ffarm.mid',
    'field-gauges.png', 'genfarm.mid', 'main-menus.json', 'map-tiles.inverted.png', 'map-tiles.png',
    'map-window.png', 'masked-tiles.png', 'move-drop.png', 'move-pick.png', 'new-farm-records.json',
    'new-farm-runtime.json', 'new-farm-setup.json', 'popup.bmp.png', 'region-map.inverted.png',
    'region-map.png', 'rodeo.mid', 'schedule-window.png', 'sell-condition.png', 'sell-window.png',
    'sftitle.png', 'share.jpg', 'swarm.sprites.png', 'terrain-tiles.frost.png', 'terrain-tiles.png',
    'terrain-tiles.rain.png', 'time-toggle.png', 'tornado.sprites.png', 'town-choice.png',
    'town-event-tiles.png', 'traffic-defaults.json', 'ui-content.json', 'weather-ground.png',
    'weather-sky.png', 'weather-vane.png', 'weather-wallpaper.png', 'weather-window.png',
    'window-close.png', 'window-frame.png', 'window-title-end-inactive.png', 'window-title-end.png',
    'window-title-inactive.png', 'window-title.png',
  ].map(name => `assets/${name}`),
  ...[...runtimeRawFiles].map(name => `assets/raw/${name}`),
]);
