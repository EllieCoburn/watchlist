/** Tiny in-memory TTL cache with request de-duplication. Per server instance; fine for rate-limit relief. */
type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (store.size > 2000) store.clear();
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function clearCache(): void {
  store.clear();
  inflight.clear();
}
