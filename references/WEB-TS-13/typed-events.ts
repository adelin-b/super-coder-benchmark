// Reference implementation for WEB-TS-13: Type-Safe Event Emitter with Inference

/**
 * Event map: maps event names to their parameter tuples.
 */
export type EventMap = Record<string, any[]>;

type WildcardListener = (event: string, ...args: any[]) => void;

/**
 * Fully type-safe event emitter.
 */
export class TypedEmitter<Events extends EventMap> {
  private _listeners: Map<string, Array<{ fn: Function; once: boolean }>> =
    new Map();
  private _wildcardListeners: WildcardListener[] = [];
  private _namespaceListeners: Map<string, WildcardListener[]> = new Map();

  on<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push({ fn: listener, once: false });
    return this;
  }

  once<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push({ fn: listener, once: true });
    return this;
  }

  off<E extends keyof Events & string>(
    event: E,
    listener: (...args: Events[E]) => void
  ): this {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.findIndex((entry) => entry.fn === listener);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
    return this;
  }

  emit<E extends keyof Events & string>(
    event: E,
    ...args: Events[E]
  ): boolean {
    let called = false;

    // Regular listeners
    const list = this._listeners.get(event);
    if (list && list.length > 0) {
      called = true;
      const toRemove: number[] = [];
      for (let i = 0; i < list.length; i++) {
        list[i].fn(...args);
        if (list[i].once) {
          toRemove.push(i);
        }
      }
      // Remove once-listeners in reverse order
      for (let i = toRemove.length - 1; i >= 0; i--) {
        list.splice(toRemove[i], 1);
      }
    }

    // Wildcard listeners
    for (const wl of this._wildcardListeners) {
      wl(event, ...args);
      called = true;
    }

    // Namespace listeners
    const dotIndex = event.indexOf(".");
    if (dotIndex !== -1) {
      const namespace = event.substring(0, dotIndex);
      const nsListeners = this._namespaceListeners.get(namespace);
      if (nsListeners) {
        for (const nsl of nsListeners) {
          nsl(event, ...args);
          called = true;
        }
      }
    }

    return called;
  }

  onAny(listener: WildcardListener): this {
    this._wildcardListeners.push(listener);
    return this;
  }

  offAny(listener: WildcardListener): this {
    const idx = this._wildcardListeners.indexOf(listener);
    if (idx !== -1) {
      this._wildcardListeners.splice(idx, 1);
    }
    return this;
  }

  onNamespace(
    namespace: string,
    listener: WildcardListener
  ): this {
    if (!this._namespaceListeners.has(namespace)) {
      this._namespaceListeners.set(namespace, []);
    }
    this._namespaceListeners.get(namespace)!.push(listener);
    return this;
  }

  listenerCount<E extends keyof Events & string>(event: E): number {
    const list = this._listeners.get(event);
    return list ? list.length : 0;
  }

  removeAllListeners<E extends keyof Events & string>(event?: E): this {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
      this._wildcardListeners = [];
      this._namespaceListeners.clear();
    }
    return this;
  }
}

/**
 * Factory function to create a typed event emitter.
 */
export function createEmitter<Events extends EventMap>(): TypedEmitter<Events> {
  return new TypedEmitter<Events>();
}
