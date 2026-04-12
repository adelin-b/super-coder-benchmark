# MULTIFILE-2: Order Fulfillment Saga System

## Overview

You are given an existing event-driven system with three files:
- `events.ts` — Event bus with typed events (subscribe/publish/unsubscribe)
- `store.ts` — Projection store maintaining materialized views from events
- `handlers.ts` — Event handlers connecting events to store updates

**All existing tests in `existing.test.ts` must continue to pass.** Do not break existing functionality.

## Your Task

Add an **Order Fulfillment Saga** system that orchestrates multi-step workflows triggered by events. You must:

### 1. Create `saga.ts` — Saga Orchestrator

```ts
export type SagaStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating';

export interface SagaStep {
  name: string;
  execute: () => void | Promise<void>;
  compensate: () => void | Promise<void>;
}

export interface SagaDefinition {
  name: string;
  steps: SagaStep[];
  timeout?: number; // ms, default 30000
}

export interface SagaInstance {
  id: string;
  definitionName: string;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  failedStep: string | null;
  compensatedSteps: string[];
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

export class SagaError extends Error {
  constructor(message: string, public readonly sagaId: string) {
    super(message);
    this.name = 'SagaError';
  }
}

export function createSagaOrchestrator(): {
  /** Register a saga definition (blueprint) */
  register(definition: SagaDefinition): void;

  /** Start a new saga instance. Returns the saga ID. */
  start(definitionName: string, sagaId: string): Promise<SagaInstance>;

  /** Get a saga instance by ID */
  getInstance(sagaId: string): SagaInstance | null;

  /** Get all instances for a given definition */
  getInstancesByDefinition(definitionName: string): SagaInstance[];

  /** Get count of active (running/compensating) sagas */
  getActiveSagaCount(): number;
};
```

### 2. Modify `events.ts` — Add New Event Types

Extend the `EventType` union to include:
```ts
| 'payment.processed'
| 'inventory.reserved'
| 'fulfillment.started'
| 'fulfillment.completed'
| 'fulfillment.failed'
```

**Critical:** The existing event types (`user.created`, `user.updated`, `order.placed`, `order.shipped`) MUST remain. Add to the union, do not replace it.

### 3. Modify `store.ts` — Add FulfillmentProjection

Add a new projection type and update the store:

```ts
export interface FulfillmentProjection {
  orderId: string;
  status: 'pending' | 'processing' | 'shipped' | 'failed';
  paymentProcessed: boolean;
  inventoryReserved: boolean;
  startedAt: number | null;
  completedAt: number | null;
  failureReason: string | null;
}
```

The store must:
- Track fulfillments by order ID
- Export `getFulfillment(orderId: string): FulfillmentProjection | null`
- Export `getAllFulfillments(): FulfillmentProjection[]`
- Keep all existing `getUser`, `getOrder`, `getAllUsers`, `getAllOrders` functions working

### 4. Modify `handlers.ts` — Add Fulfillment Event Handlers

Add handlers for:
- `payment.processed` — Create a fulfillment record with `paymentProcessed: true`, status `'pending'`
- `inventory.reserved` — Set `inventoryReserved: true` on the fulfillment. If both payment and inventory done, set status to `'processing'`
- `fulfillment.started` — Set status to `'processing'`, record `startedAt`
- `fulfillment.completed` — Set status to `'shipped'`, record `completedAt`
- `fulfillment.failed` — Set status to `'failed'`, record `failureReason` from payload

**Critical:** All existing handler registrations must remain intact. The `wireHandlers` function must continue to wire old handlers AND add the new ones.

## Saga Execution Rules

### Step Execution
1. Steps execute in order (index 0, 1, 2, ...).
2. Each step's `execute()` is called. If it succeeds, move to the next step.
3. If all steps succeed, saga status becomes `'completed'`.

### Compensation (Rollback)
4. If any step's `execute()` throws, saga enters `'compensating'` status.
5. Compensation runs in **reverse order** of completed steps (last completed first).
6. Each completed step's `compensate()` is called.
7. After all compensations run, saga status becomes `'failed'`.
8. If a compensation itself throws, the saga still becomes `'failed'` but the error is recorded.

### Timeout
9. If `timeout` is specified and execution exceeds it, the saga should fail with a timeout error and trigger compensation.
10. Default timeout is 30000ms.

### Concurrent Sagas
11. Multiple saga instances can run concurrently.
12. One saga's failure must NOT affect another saga's state.
13. Each saga instance is independently tracked.

### Validation
- `register()` with a duplicate name should throw `SagaError`.
- `start()` with an unregistered definition name should throw `SagaError`.
- `start()` with a duplicate saga ID should throw `SagaError`.

## Event Payloads

```ts
// payment.processed
{ orderId: string, amount: number, transactionId: string }

// inventory.reserved
{ orderId: string, items: Array<{ sku: string, quantity: number }> }

// fulfillment.started
{ orderId: string }

// fulfillment.completed
{ orderId: string, trackingNumber: string }

// fulfillment.failed
{ orderId: string, reason: string }
```

## File Structure

After your changes:
- `events.ts` — Modified (extended EventType union + existing code untouched)
- `store.ts` — Modified (added FulfillmentProjection + existing code untouched)
- `handlers.ts` — Modified (added new handlers + existing handlers untouched)
- `saga.ts` — New file (saga orchestrator)

## Invariants

1. All 20 existing tests in `existing.test.ts` must pass unchanged.
2. The `EventType` union must be a superset of the original types.
3. `createEventBus()` API must remain identical.
4. `createProjectionStore()` must still return all original methods.
5. `wireHandlers()` must still accept the same arguments and wire all original handlers.
6. Saga compensation must run in reverse order of completed steps.
7. Concurrent saga instances must be isolated from each other.
