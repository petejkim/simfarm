import { useEffect, useState } from 'react';

export type Resource<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: string };

/** The loader must be stable (module function or useCallback). Cleanup cancels stale requests. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setResource({ status: 'loading' });
    void load(controller.signal).then(
      value => { if (!controller.signal.aborted) setResource({ status: 'ready', value }); },
      error => { if (!controller.signal.aborted) setResource({ status: 'error', error: String(error) }); },
    );
    return () => controller.abort();
  }, [load]);
  return resource;
}
