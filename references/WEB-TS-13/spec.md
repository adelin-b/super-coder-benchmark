# WEB-TS-13: Type-Safe Event Emitter with Inference

## Overview
Create a fully type-safe event emitter where event names, listener parameter types, and emit arguments are all validated at compile time. Support wildcard listeners, once listeners, namespace events, and typed emit enforcement.

## What You Must Implement

In the file `typed-events.ts`, implement and export:

### 1. `EventMap` type
A type alias for event map definitions:
```ts
type MyEvents = {
  click: [x: number, y: number]
  message: [text: string, sender: string]
  'user.created': [user: { id: number; name: string }]
  'user.deleted': [userId: number]
  disconnect: []
}
```
Each key is an event name, and the value is a tuple of the listener's parameters.

### 2. `TypedEmitter<Events extends EventMap>`
A class that implements:

- **`.on<E>(event: E, listener: (...args: Events[E]) => void): this`**
  Register a listener. `E` must be a key of `Events`. The listener's parameters are inferred from the event map.

- **`.once<E>(event: E, listener: (...args: Events[E]) => void): this`**
  Like `.on()` but the listener fires at most once, then auto-removes.

- **`.off<E>(event: E, listener: (...args: Events[E]) => void): this`**
  Remove a specific listener for an event.

- **`.emit<E>(event: E, ...args: Events[E]): boolean`**
  Emit an event with the correct arguments. Returns true if any listeners were called. The argument types are enforced by the event map.

- **`.onAny(listener: (event: string, ...args: any[]) => void): this`**
  Register a wildcard listener that fires for ALL events. Receives the event name as first arg.

- **`.offAny(listener: (event: string, ...args: any[]) => void): this`**
  Remove a wildcard listener.

- **`.listenerCount<E>(event: E): number`**
  Returns the count of listeners for a specific event.

- **`.removeAllListeners<E>(event?: E): this`**
  Remove all listeners for a specific event, or all events if no argument.

### 3. Namespace support
Events with dots (e.g., `'user.created'`) are namespace events. Implement:

- **`.onNamespace(namespace: string, listener: (event: string, ...args: any[]) => void): this`**
  Listen to all events that start with `${namespace}.`. E.g., `.onNamespace('user', fn)` fires for both `user.created` and `user.deleted`.

### 4. `createEmitter<Events extends EventMap>(): TypedEmitter<Events>`
Factory function.

## Key Constraints
- `.on('click', (x, y) => ...)` must infer `x: number, y: number` from the event map without explicit annotation.
- `.emit('click', 'wrong')` must be a compile-time error (string instead of number).
- `.emit('click', 1, 2, 3)` must be a compile-time error (too many args).
- `.emit('nonexistent')` must be a compile-time error.
- `.on('nonexistent', fn)` must be a compile-time error.
- Events with zero parameters (`disconnect: []`) must work: `.emit('disconnect')` with no extra args.
- The wildcard `.onAny()` is not type-narrowed (it receives `any[]` args) -- this is intentional.
- Namespace listeners are also not type-narrowed.
