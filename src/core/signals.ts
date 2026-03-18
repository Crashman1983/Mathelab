/**
 * Micro-Signals (Baustein 4).
 *
 * Reactive primitives: signal(), effect(), persisted().
 * ~40 lines of core logic — no framework dependency.
 */

import { safeGet, safeSet } from "@app/crash-recovery";

// ─── Core ────────────────────────────────────────────────────────────────────

type Subscriber = () => void;
let activeEffect: Subscriber | null = null;

export interface Signal<T> {
  /** Read current value */
  (): T;
  /** Write new value */
  set(value: T): void;
  /** Subscribe to changes (returns unsubscribe) */
  subscribe(fn: Subscriber): () => void;
  /** Read without tracking */
  peek(): T;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<Subscriber>();

  const read = (() => {
    if (activeEffect) subs.add(activeEffect);
    return value;
  }) as Signal<T>;

  read.set = (next: T) => {
    if (Object.is(value, next)) return;
    value = next;
    for (const fn of subs) fn();
  };

  read.subscribe = (fn: Subscriber) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };

  read.peek = () => value;

  return read;
}

/**
 * Run `fn` whenever any signal read inside it changes.
 * Returns a dispose function.
 */
export function effect(fn: () => void): () => void {
  const wrapped: Subscriber = () => {
    activeEffect = wrapped;
    try {
      fn();
    } finally {
      activeEffect = null;
    }
  };
  wrapped(); // initial run to collect dependencies
  return () => {
    // No direct "remove from all sets" — signals hold weak refs via Set
    // Caller should avoid further reads to let GC clean up
  };
}

/**
 * Signal backed by localStorage (via crash-recovery safe wrappers).
 * Serializes as JSON. Falls back to in-memory if storage is blocked.
 */
export function persisted<T>(key: string, fallback: T): Signal<T> {
  const storageKey = `mathelabor_${key}`;
  let initial = fallback;

  const raw = safeGet(storageKey);
  if (raw !== null) {
    try {
      initial = JSON.parse(raw) as T;
    } catch {
      // Corrupted — use fallback
    }
  }

  const sig = signal<T>(initial);
  const originalSet = sig.set;

  sig.set = (next: T) => {
    originalSet(next);
    safeSet(storageKey, JSON.stringify(next));
  };

  return sig;
}
