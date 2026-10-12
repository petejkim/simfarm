import type { GameSimulation, GameSnapshot } from '../simulation/game';
import { GameStore, type StoredGame } from './game-store';

export type SaveOutcome = { ok: true } | { ok: false; reason: 'unavailable' | 'other-tab' | 'error'; error?: string };
interface Target { simulation: GameSimulation; scenarioId: number | null }
const LOCK = 'simfarm-current-game';
const weekKey = (s: GameSnapshot) => { const c = s.scenario.farm.calendar; return `${c.year}-${c.month}-${c.week}`; };

/** Keeps the IndexedDB current-game slot up to date. Saves when a game starts (New Game or a loaded
 * file), at each calendar week rollover, on manual Save, and flushes when the tab is hidden or closing.
 * Only the tab holding a Web Lock writes; a second tab waits and takes over when the first closes.
 * Owned outside React; UI calls `connect` (idempotent, StrictMode-safe), attaches the current simulation
 * and reads outcomes. The constructor has no side effects. */
export class Autosave {
  private initialised: Promise<void> | null = null;
  private store: GameStore | null = null;
  private owner = false;
  private target: Target | null = null;
  private lastSaved: GameSnapshot | null = null;
  private persistRequested = false;
  private readonly flush = () => { if (document.visibilityState === 'hidden') void this.saveIfChanged(); };
  private readonly pagehide = () => { void this.saveIfChanged(); };

  /** Opens the store and claims the writer lock once; later calls reuse the same work. */
  ready(): Promise<void> {
    return this.initialised ??= (async () => { this.store = await GameStore.open(); this.owner = await this.claim(); })();
  }

  /** Starts the hide/close flush listeners. Returns their removal; the store and lock stay for the page's life. */
  connect(): () => void {
    void this.ready();
    document.addEventListener('visibilitychange', this.flush); window.addEventListener('pagehide', this.pagehide);
    return () => { document.removeEventListener('visibilitychange', this.flush); window.removeEventListener('pagehide', this.pagehide); };
  }

  /** The stored game to restore at startup, if any. */
  async read(): Promise<StoredGame | null> { await this.ready(); return this.store ? this.store.read().catch(() => null) : null; }
  async reject(record: StoredGame) { await this.ready(); await this.store?.reject(record).catch(() => {}); }

  /** Follows a running game; `saveNow` writes immediately (New Game, Load from File). Returns a detach. */
  attach(simulation: GameSimulation, scenarioId: number | null, saveNow: boolean): () => void {
    const target: Target = { simulation, scenarioId };
    this.target = target; this.lastSaved = null;
    let week = weekKey(simulation.getSnapshot());
    const unsubscribe = simulation.subscribe(() => {
      const next = weekKey(simulation.getSnapshot());
      if (next !== week) { week = next; void this.save(); }
    });
    if (saveNow) void this.ready().then(() => { if (this.target === target) void this.save(); });
    return () => { unsubscribe(); if (this.target === target) this.target = null; };
  }

  /** Writes the attached game now. The snapshot and IndexedDB put happen synchronously before the first await. */
  save(): Promise<SaveOutcome> {
    const target = this.target;
    if (!this.store || !target) return Promise.resolve({ ok: false, reason: 'unavailable' });
    if (!this.owner) return Promise.resolve({ ok: false, reason: 'other-tab' });
    let committed: Promise<void>;
    try {
      const snapshot = target.simulation.getSnapshot();
      committed = this.store.write(target.simulation.save(target.scenarioId));
      this.lastSaved = snapshot;
    } catch (error) { return Promise.resolve({ ok: false, reason: 'error', error: String(error instanceof Error ? error.message : error) }); }
    if (!this.persistRequested) { this.persistRequested = true; void navigator.storage?.persist?.().catch(() => false); }
    return committed.then((): SaveOutcome => ({ ok: true }),
      (error): SaveOutcome => ({ ok: false, reason: 'error', error: String(error instanceof Error ? error.message : error) }));
  }

  private saveIfChanged() {
    if (this.target && this.target.simulation.getSnapshot() !== this.lastSaved) return this.save();
  }

  private claim(): Promise<boolean> {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.request) return Promise.resolve(true);
    return new Promise(resolve => {
      locks.request(LOCK, { ifAvailable: true }, lock => {
        resolve(Boolean(lock));
        if (lock) return new Promise<void>(() => {}); // held for the page's lifetime
        // Another tab owns the slot: queue, and take over when it closes.
        void locks.request(LOCK, () => { this.owner = true; return new Promise<void>(() => {}); });
        return undefined;
      }).catch(() => resolve(true));
    });
  }
}
