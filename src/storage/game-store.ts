/** IndexedDB persistence for the single current-game slot. Plain TypeScript; no UI or simulation state.
 * The record holds the native checkpoint text exactly as `GameSimulation.save` produces it. */
export interface StoredGame { version: 1; savedAt: number; text: string }

const DATABASE = 'simfarm', STORE = 'games', CURRENT = 'current', REJECTED = 'rejected';

export class GameStore {
  private constructor(private readonly db: IDBDatabase) {}

  /** Opens the database, or resolves null where IndexedDB is unavailable (e.g. some private modes). */
  static open(): Promise<GameStore | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise(resolve => {
      let request: IDBOpenDBRequest;
      try { request = indexedDB.open(DATABASE, 1); } catch { resolve(null); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
      request.onsuccess = () => resolve(new GameStore(request.result));
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  read(): Promise<StoredGame | null> {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(STORE, 'readonly').objectStore(STORE).get(CURRENT);
      request.onsuccess = () => resolve((request.result as StoredGame | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  /** Queues the write synchronously (IndexedDB copies the record inside `put`), so a caller in a
   * `visibilitychange`/`pagehide` handler has captured the snapshot before returning. Resolves on commit. */
  write(text: string): Promise<void> {
    const record: StoredGame = { version: 1, savedAt: Date.now(), text };
    const transaction = this.db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(record, CURRENT);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('Save was not stored.'));
    });
  }

  /** Moves an unreadable current record aside instead of letting the next save overwrite it. */
  reject(record: StoredGame): Promise<void> {
    const transaction = this.db.transaction(STORE, 'readwrite'), store = transaction.objectStore(STORE);
    store.put(record, REJECTED); store.delete(CURRENT);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  }
}
