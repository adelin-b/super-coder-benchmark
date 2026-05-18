# SEMANTIC-MIRAGE-2: XState v5 Upload Machine

## Overview
Implement a file-upload state machine in **XState v5** that:
- Idles waiting for an upload trigger
- Validates the file (size + mime type) via a *pure* guard
- Invokes an upload actor (`fromPromise`)
- Handles success / failure with retry (max 2 retries) and a give-up state
- Tracks attempt count in context

Targets the XState semantic-mirage patterns (X1–X6 in `docs/MIRAGE-TAXONOMY.md`). Tests exercise the runtime contract.

## Exported API

```ts
import { setup, createActor, fromPromise, assign, type ActorRefFrom } from 'xstate';

export interface UploadContext {
  file: File | null;
  attempts: number;
  errorMessage: string | null;
  uploadedUrl: string | null;
}

export type UploadEvent =
  | { type: 'UPLOAD'; file: File }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export interface File {
  name: string;
  size: number;
  type: string;
  blob: Uint8Array;
}

export type Uploader = (file: File) => Promise<{ url: string }>;

export const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'application/pdf'];

export function buildUploadMachine(uploader: Uploader): ReturnType<typeof setup>['createMachine'] extends (...a: never[]) => infer R ? R : never;
```

The function returns the machine value created from `setup({...}).createMachine({...})`. Caller wraps with `createActor`.

## Detailed requirements

### States

- `idle` — initial. Accepts `UPLOAD`. Transitions to `validating` with `file` assigned to context.
- `validating` — synchronous validation via guards.
  - If file invalid (too big OR unsupported mime) → `rejected` (eventless transition with guards). `errorMessage` set to `"too large"` or `"unsupported type"`.
  - Else → `uploading`.
- `uploading` — invokes the uploader via `fromPromise`. Increments `attempts` on entry.
  - `onDone` → `success` with `uploadedUrl` assigned.
  - `onError` → `failed` with `errorMessage` assigned.
- `failed` — accepts `RETRY` (only if `attempts < 3`, guard) → back to `uploading`. Also accepts `RESET` → `idle` (clears context).
- `success` — terminal-ish. Accepts `RESET` → `idle`.
- `rejected` — final. Accepts `RESET` → `idle`.

### Context

- `file` and `errorMessage` cleared on RESET.
- `attempts` starts at 0. Increments on each entry to `uploading`. Reset on RESET.
- `uploadedUrl` cleared on RESET.

### Guards (must be pure)

- `isValidFile`: file !== null AND size ≤ MAX_SIZE_BYTES AND type in ALLOWED_MIME.
- `isTooLarge`: file !== null AND size > MAX_SIZE_BYTES.
- `isUnsupportedType`: file !== null AND type not in ALLOWED_MIME.
- `canRetry`: attempts < 3.

**Critical**: guards MUST NOT mutate context. They MUST be deterministic — same args produce same result.

### Actions

- `assignFile`, `assignUrl`, `assignError(message)`, `incrementAttempts`, `resetCtx`.

### Eventless transitions in `validating`

```ts
validating: {
  always: [
    { target: 'rejected', guard: 'isTooLarge', actions: ... },
    { target: 'rejected', guard: 'isUnsupportedType', actions: ... },
    { target: 'uploading' }
  ]
}
```

The `always` must have at least one guarded branch or unconditional final fallback to avoid X3 (infinite loop).

## Invariants

1. Sending the same `UPLOAD` event with a valid file twice in a row (with `RESET` between) produces 2 distinct `xstate.done.actor.uploader` events.
2. With a 6 MB file, machine ends in `rejected` with `errorMessage === 'too large'`, attempts stays at 0.
3. With an `image/gif` (3 MB) file, machine ends in `rejected` with `errorMessage === 'unsupported type'`.
4. Uploader rejection bumps `attempts` to 1, transitions to `failed`. `RETRY` while `attempts < 3` re-enters `uploading` and bumps to 2, etc. After 3rd failure, `RETRY` is ignored (still in `failed`).
5. The `cond` key (XState v4) MUST NOT appear in the implementation — v5 silently ignores it (X4). Tests assert behavior reflects the guard.
6. `assign` MUST live inside `actions: [...]`, never as a direct transition key (X5).
7. The `invoke.id` referenced by `onDone`/`onError` MUST match the listener id (X6).

## Why this is mirage-rich

- X1: a confused author writes `guard: ({context}) => { context.attempts++; return context.attempts < 3; }` — bumps `attempts` on every transition test, making `canRetry` flip after one send.
- X3: `validating` `always` with no guarded fallback → loop.
- X4: copying a v4 snippet and using `cond: 'isValidFile'` — silently accepted.
- X5: `on: { UPLOAD: { target: 'validating', assign: { file: ... } } }` — `file` never set in context, validation guard fails on `null`.
- X6: `invoke: { id: 'uploader', ... }` but `onDone` listener wired as `'xstate.done.actor.upload'` — hangs.
