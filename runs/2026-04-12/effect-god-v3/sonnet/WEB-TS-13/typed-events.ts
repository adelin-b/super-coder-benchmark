import { Effect, Data } from "effect";

// ─── Public Types ────────────────────────────────────────────────────────────

export type EventMap = Record<string, any[]>;

// ─── Internal Tagged Errors ──────────────────────────────────────────────────

class EmitterError extends Data.TaggedError("EmitterError")<{
  reason: string;
}> {}

// ─── TypedEmitter Class ──────────────────────────────────────────────────────

export class TypedEmitter<Events extends EventMap> {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private onceListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private anyListeners: Set<(event: string, ...args: any[]) => void> = new Set();
  private namespaceListeners: Map<
    string,
    Set<(event: string, ...args: any[]) => void>
  > = new Map();

  on<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    const effect = Effect.gen(function* () {
      return listener;
    });
    const result = Effect.runSync(effect);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(result as (...args: any[]) => void);
    return this;
  }

  once<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(listener as (...args: any[]) => void);
    return this;
  }

  off<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    this.listeners.get(event)?.delete(listener as (...args: any[]) => void);
    this.onceListeners.get(event)?.delete(listener as (...args: any[]) => void);
    return this;
  }

  emit<E extends keyof Events & string>(event: E, ...args: Events[E]): boolean {
    let called = false;

    // Regular listeners
    const regularSet = this.listeners.get(event);
    if (regularSet && regularSet.size > 0) {
      for (const listener of regularSet) {
        listener(...args);
        called = true;
      }
    }

    // Once listeners
    const onceSet = this.onceListeners.get(event);
    if (onceSet && onceSet.size > 0) {
      const snapshot = [...onceSet];
      onceSet.clear();
      for (const listener of snapshot) {
        listener(...args);
        called = true;
      }
    }

    // Wildcard listeners
    for (const listener of this.anyListeners) {
      listener(event, ...args);
      called = true;
    }

    // Namespace listeners
    const dotIndex = event.indexOf(".");
    if (dotIndex !== -1) {
      const namespace = event.slice(0, dotIndex);
      const nsSet = this.namespaceListeners.get(namespace);
      if (nsSet) {
        for (const listener of nsSet) {
          listener(event, ...args);
          called = true;
        }
      }
    }

    return called;
  }

  onAny(listener: (event: string, ...args: any[]) => void): this {
    this.anyListeners.add(listener);
    return this;
  }

  offAny(listener: (event: string, ...args: any[]) => void): this {
    this.anyListeners.delete(listener);
    return this;
  }

  listenerCount<E extends keyof Events & string>(event: E): number {
    const regular = this.listeners.get(event)?.size ?? 0;
    const once = this.onceListeners.get(event)?.size ?? 0;
    return regular + once;
  }

  removeAllListeners<E extends keyof Events & string>(event?: E): this {
    if (event === undefined) {
      this.listeners.clear();
      this.onceListeners.clear();
    } else {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    }
    return this;
  }

  onNamespace(
    namespace: string,
    listener: (event: string, ...args: any[]) => void
  ): this {
    if (!this.namespaceListeners.has(namespace)) {
      this.namespaceListeners.set(namespace, new Set());
    }
    this.namespaceListeners.get(namespace)!.add(listener);
    return this;
  }

  offNamespace(
    namespace: string,
    listener: (event: string, ...args: any[]) => void
  ): this {
    this.namespaceListeners.get(namespace)?.delete(listener);
    return this;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createEmitter<Events extends EventMap>(): TypedEmitter<Events> {
  return new TypedEmitter<Events>();
}