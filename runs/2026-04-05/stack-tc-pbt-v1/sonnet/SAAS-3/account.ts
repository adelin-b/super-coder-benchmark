// ────────────────────────────────────────────────────────────
// account.ts — Event-Sourced Bank Account Aggregate
// ────────────────────────────────────────────────────────────

// ── Event shapes ─────────────────────────────────────────────

export interface AccountOpenedEvent {
  readonly type: "AccountOpened";
  readonly accountId: string;
  readonly owner: string;
  readonly initialBalance: number;
  readonly timestamp: Date;
}

export interface DepositedEvent {
  readonly type: "Deposited";
  readonly accountId: string;
  readonly amount: number;
  readonly timestamp: Date;
}

export interface WithdrawnEvent {
  readonly type: "Withdrawn";
  readonly accountId: string;
  readonly amount: number;
  readonly timestamp: Date;
}

export interface TransferSentEvent {
  readonly type: "TransferSent";
  readonly accountId: string;
  readonly toAccountId: string;
  readonly amount: number;
  readonly timestamp: Date;
}

export interface TransferReceivedEvent {
  readonly type: "TransferReceived";
  readonly accountId: string;
  readonly fromAccountId: string;
  readonly amount: number;
  readonly timestamp: Date;
}

export type AccountEvent =
  | AccountOpenedEvent
  | DepositedEvent
  | WithdrawnEvent
  | TransferSentEvent
  | TransferReceivedEvent;

// ── Aggregate state ───────────────────────────────────────────

export interface AccountState {
  readonly id: string;
  readonly owner: string;
  readonly balance: number;
}

// ── Custom errors ─────────────────────────────────────────────

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class AccountNotOpenedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountNotOpenedError";
  }
}

// ── Helpers ───────────────────────────────────────────────────

function assertPositiveAmount(amount: number, label: string): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidAmountError(`${label} must be a finite positive number, got ${amount}`);
  }
}

function now(): Date {
  return new Date();
}

// ── Command: open ─────────────────────────────────────────────

/**
 * Create a new account.
 * @param accountId  Unique identifier for the account.
 * @param owner      Name / identifier of the account holder.
 * @param initialBalance  Starting balance (must be ≥ 0, defaults to 0).
 */
export function openAccount(
  accountId: string,
  owner: string,
  initialBalance = 0
): AccountOpenedEvent {
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    throw new InvalidAmountError(
      `initialBalance must be a finite non-negative number, got ${initialBalance}`
    );
  }
  if (!accountId) throw new InvalidAmountError("accountId must be a non-empty string");
  if (!owner) throw new InvalidAmountError("owner must be a non-empty string");

  return {
    type: "AccountOpened",
    accountId,
    owner,
    initialBalance,
    timestamp: now(),
  };
}

// ── Command: deposit ──────────────────────────────────────────

/**
 * Deposit funds into an account.
 * Requires the current state so the accountId can be verified.
 */
export function deposit(state: AccountState, amount: number): DepositedEvent {
  assertPositiveAmount(amount, "Deposit amount");
  return {
    type: "Deposited",
    accountId: state.id,
    amount,
    timestamp: now(),
  };
}

// ── Command: withdraw ─────────────────────────────────────────

/**
 * Withdraw funds from an account.
 * Throws InsufficientFundsError if balance would go below 0.
 */
export function withdraw(state: AccountState, amount: number): WithdrawnEvent {
  assertPositiveAmount(amount, "Withdrawal amount");
  if (amount > state.balance) {
    throw new InsufficientFundsError(
      `Cannot withdraw ${amount} from account ${state.id}: balance is ${state.balance}`
    );
  }
  return {
    type: "Withdrawn",
    accountId: state.id,
    amount,
    timestamp: now(),
  };
}

// ── Command: transfer ─────────────────────────────────────────

/**
 * Transfer funds from one account to another.
 * Returns a tuple of [TransferSentEvent, TransferReceivedEvent].
 * Throws InsufficientFundsError if the sender's balance is too low.
 */
export function transfer(
  fromState: AccountState,
  toState: AccountState,
  amount: number
): [TransferSentEvent, TransferReceivedEvent] {
  assertPositiveAmount(amount, "Transfer amount");
  if (amount > fromState.balance) {
    throw new InsufficientFundsError(
      `Cannot transfer ${amount} from account ${fromState.id}: balance is ${fromState.balance}`
    );
  }
  const timestamp = now();
  const sent: TransferSentEvent = {
    type: "TransferSent",
    accountId: fromState.id,
    toAccountId: toState.id,
    amount,
    timestamp,
  };
  const received: TransferReceivedEvent = {
    type: "TransferReceived",
    accountId: toState.id,
    fromAccountId: fromState.id,
    amount,
    timestamp,
  };
  return [sent, received];
}

// ── Event application (reducer) ───────────────────────────────

/**
 * Apply a single event to an existing state (or null for the first event).
 * The first event MUST be AccountOpened.
 */
export function applyEvent(
  state: AccountState | null,
  event: AccountEvent
): AccountState {
  if (state === null) {
    if (event.type !== "AccountOpened") {
      throw new AccountNotOpenedError(
        "First event must be AccountOpened"
      );
    }
    return {
      id: event.accountId,
      owner: event.owner,
      balance: event.initialBalance,
    };
  }

  switch (event.type) {
    case "AccountOpened":
      // Re-opening is a no-op (idempotent replay guard)
      return state;

    case "Deposited":
      return { ...state, balance: state.balance + event.amount };

    case "Withdrawn":
      return { ...state, balance: state.balance - event.amount };

    case "TransferSent":
      return { ...state, balance: state.balance - event.amount };

    case "TransferReceived":
      return { ...state, balance: state.balance + event.amount };

    default: {
      // exhaustive check
      const _exhaustive: never = event;
      throw new Error(`Unknown event type: ${(_exhaustive as AccountEvent).type}`);
    }
  }
}

// ── Reconstruct ───────────────────────────────────────────────

/**
 * Reconstruct the current AccountState by replaying an ordered
 * sequence of events.  The first event must be AccountOpened.
 *
 * @param events  Ordered list of domain events for ONE account.
 * @returns       The current AccountState after all events are applied.
 */
export function reconstruct(events: readonly AccountEvent[]): AccountState {
  if (events.length === 0) {
    throw new AccountNotOpenedError("Cannot reconstruct state from an empty event list");
  }
  let state: AccountState | null = null;
  for (const event of events) {
    state = applyEvent(state, event);
  }
  return state as AccountState;
}