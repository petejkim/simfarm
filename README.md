# SimFarm native preservation

Incremental reconstruction of the supplied 16-bit DOS SimFarm as a native TypeScript/React/Vite browser game, developed with Bun. No DOS runtime or x86 emulator is used. The current build supports land purchase, new fields, planting, crop treatments, growing, harvesting, storage and crop sales, with machinery, weather, calendar progression and converted MIDI music. Positive-value corn farming cycles on existing fields and newly purchased/fertilized land are verified in the browser. Native save/load is available; DOS-compatible export and many other original systems remain unfinished.

## Run locally

Requires your original game files at `../simfarm-dos`. The bootstrap downloads Bun 1.4.2 into `.tools/bun` on macOS or Linux. No global installation or separate Node/npm runtime is needed.

```sh
sh tools/setup-bun.sh
./tools/bun install --frozen-lockfile
./tools/bun run import
./tools/bun run dev
```

Open the local URL printed by Vite. Choose one of eight scenarios, locate a field to see its crop and work status, scroll or use arrow keys to explore, zoom, click tiles, browse 24 crops, and start music. To import from another directory: `./tools/bun run import /path/to/simfarm-dos`.

Farms start paused. Select a field, choose **Crop to plant**, and press **Plant crop**. Planting replaces the existing crop, consumes stored seed or purchases it with a delivery surcharge, and uses owned or automatically rented machinery according to the farm's saved settings. Use **Next day** to step or **Play** to run. The **Speed** slider adjusts pacing from **0.25× to 16×**; at the default **1×**, one real second advances one game day. **Pause** stops progression, and **Next day** always advances one day regardless of speed. Machinery completes two field passes and returns home; crops then age, change appearance and can expire. Work already underway must finish before another planting order. Saved crop plans run automatically each week, including planting, harvest and field care. Weekly boundaries finish outstanding field work. Manual planting rebuilds that field’s future crop plan; care orders record the current week when it is available. To open the planner, select a field on the map (or under **Locate a field**), scroll down the side panel, and expand **Crop plan · Field N**. Choose a year and week, select a **Plan action**, then press **Apply plan change**. Future weeks support planting, field care, harvest and clearing the remaining plan. Planting replaces the plan from the selected week onward. Crops with fixed annual harvest dates cannot have their harvest moved. To lock a growing crop’s current price, select the current week and **Lock crop price**. Planner changes are included in native saves.

To expand, choose **Map tool → Buy land**, click a plot, check its price and soil fertility, and press **Buy plot**. The tool switches to **New field** at the plot's corner. Enable **Automatically clear trees and fences** when needed, choose a crop and press **Create and plant field**. You can also select **New field** directly and click an 8×8 field's top-left corner on owned land. The preview and status explain blocked placements; fields need a one-tile gap. New land retains its original soil conditions, often too poor for a valuable crop without fertilization.

To add storage, choose **Map tool → Build storage**, choose a building, click its top-left corner, and press **Build storage**. Small and large crop storage hold one or four harvested lots; returning equipment can use the other four storage buildings. The map preview and status show placement problems and clearing costs. **Automatically clear trees** shares the farm's clearing setting. Construction costs, buildings, contents and accounts survive **Save farm** / **Load farm**. Water-related buildings and livestock controls remain under reconstruction.

Select a field and use **Field care → Fertilizer → Apply fertilizer** to restore its nutrients. Pesticide, herbicide and fungicide remove current pests, weeds or fungus and reduce their pressure, but add soil toxicity. Treatments use one stored supply or automatically buy it for $275 according to the original shared supply-buying setting. A tractor and sprayer complete the job while time advances; missing machines may incur rental fees. Wait for planting/harvest work to finish before ordering treatment. Fertilizer does not undo damage already accumulated by the crop, so treating poor soil early matters.

Select **Harvest crop** to send machinery or workers to a growing crop. Maturity and estimated value help with timing; early or damaged crops can be worth $0. Harvests enter available storage, or sell automatically when storage is unavailable. Use **Sell for $…** under **Harvest in storage** to sell a stored lot and free its space. Worker fees and missing equipment rentals can reduce returns. Other fields also follow their saved plans, and planting changes live crop prices, including the sale value of stored lots.

Expand **Loans** directly below the time controls to borrow against your farm, see the installment quote, or **Pay off loan**. Installments run at the start of January, March, July and October; unpaid installments retry monthly and can trigger forced asset sales. The overdue installment is shown separately from the main loan balance. If available assets cannot cover a debt, the game stops and offers **Restart this farm** or **End session**. Loan balances and pending decisions survive native saves. Annual tax collection and town development are still being connected.

Use **Save farm** to download a `.simfarm.json` checkpoint and **Load farm** to resume it, including after closing or reloading the page. Saves retain work in progress, weather, random state, prices, financial accounts, pending default decisions, pause and speed. Load requires the same imported original assets; invalid files leave the current farm intact. These are native saves, not DOS-compatible SSM files. Switching scenarios starts a fresh paused simulation at 1× speed, so save first to keep your work. Clock pacing is a browser convenience, not the recovered DOS interrupt rate. Seed/rental charges, loan installments and monthly debt retries run; annual tax collection/reset, town development, disasters and other unfinished systems remain incomplete.

Original files are never modified. Extracted resources are generated in ignored `public/assets`; they are not committed. Import precedes building so the browser bundle can run independently of the DOS distribution directory. Missing resources produce startup instructions.

## Validate

```sh
./tools/bun test
./tools/bun run build
PLAYWRIGHT_BROWSERS_PATH=.tools/playwright ./tools/bun run playwright install chromium
./tools/bun run test:browser
```

Browser checks cover all maps, source-exact crop/overlay pixels, field inspection, crop selection, zoom, actual audio output, stopping playback, pending-load cancellation, missing-asset recovery, time and speed controls, land purchases, new-field creation, planting/treatment commands, worker/machine harvesting, storage and complete plant/grow/harvest/sell cycles, including fertilized new land. See `docs/progress.md` for the latest completed validation and any environment limitations. Tests read the original source distribution. `./tools/bun run preview` serves the production build.

## Static reconstruction tools

```sh
sh tools/setup-analysis.sh
./tools/bun run analyze --start 0x4543c --size 0x1000
```

Capstone and its dependencies are installed only in `.venv`. The analyzer writes an overlay map and requested disassembly ranges to ignored `artifacts`. Bun downloads use `.cache/bun`; browser binaries use `.tools/playwright`. `tools/bun` sets repository-local tool/cache paths, and `bunfig.toml` runs script dependencies with Bun even when they declare Node shebangs. See [Bun's runtime configuration](https://bun.sh/docs/runtime/bunfig) and [Vite's React plugin support](https://vite.dev/guide/features.html).

React components in `src/ui` own menus, selections and lifecycle. `src/render` draws the native canvas, `src/formats` decodes original data, `src/assets` loads resources, and `src/audio` plays MIDI and original PCM effects. Recovered simulation belongs outside React so game rules can be tested independently and future graphics/UI changes can reuse them.

`src/simulation/GameSimulation` (implemented in `game.ts`) owns global game state, provides detached snapshots through `getSnapshot`/`subscribe`, and accepts commands. React uses `useSyncExternalStore`; hooks do not own simulation state. Recovered calendar, weather, field conditions, growth and expiry routines are tested against original data and executable-derived cases. Random streams are deterministic with explicit seeds; complete DOS startup/frame random consumption is not reproduced yet.

See [the plan](docs/plan.md), [progress](docs/progress.md), and [binary evidence](docs/reverse-engineering.md). The world decoder, crop graphics substitution, masked tile layer, moving machinery and field operations come from original executable evidence. Remaining render passes and game rules require more reconstruction. Music uses original MIDI notes/program changes with a temporary Web Audio synthesizer; instrument fidelity and XMIDI looping are unfinished.

At year-end your homestead changes with the original cash bands. Upgrade/downgrade notices include **View home** to center the map. **Play music** also enables automatic original track changes from farm conditions and home upgrades; **Stop music** keeps those requests silent. **Enable sounds** separately enables the original cheers/boos effects. Both audio controls start off. Native saves retain the house and its last applied rank without replaying its sounds on load.
