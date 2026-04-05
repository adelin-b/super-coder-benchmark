// account.ts

// ─── Custom Errors ────────────────────────────────────────────────────────────

export class InvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Amount must be a positive number, received: ${amount}`);
    this.name = "InvalidAmountError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: balance is ${balance}, attempted to debit ${amount}`);
    this.name = "InsufficientFundsError";
  }
}

export class SameAccountTransferError extends Error {
  constructor(accountId: string) {
    super(`Cannot transfer to the same account: ${accountId}`);
    this.name = "SameAccountTransferError";
  }
}

export class UnknownEventError extends Error {
  constructor(type: string) {
    super(`Unknown event type: ${type}`);
    this.name = "UnknownEventError";
  }
}

// ─── Event Types ─────────────────────────────────────────────────────────────

export type AccountEventType =
  | "Deposited"
  | "Withdrawn"
  | "TransferredOut"
  | "TransferredIn";

export interface BaseEvent {
  readonly type: AccountEventType;
  readonly accountId: string;
  readonly amount: number;
  readonly timestamp: Date;
  readonly version: number;
}

export interface DepositedEvent extends BaseEvent {
  readonly type: "Deposited";
}

export interface WithdrawnEvent extends BaseEvent {
  readonly type: "Withdrawn";
}

export interface TransferredOutEvent extends BaseEvent {
  readonly type: "TransferredOut";
  readonly toAccountId: string;
}

export interface TransferredInEvent extends BaseEvent {
  readonly type: "TransferredIn";
  readonly fromAccountId: string;
}

export type AccountEvent =
  | DepositedEvent
  | WithdrawnEvent
  | TransferredOutEvent
  | TransferredInEvent;

// ─── State ────────────────────────────────────────────────────────────────────

export interface AccountState {
  readonly accountId: string;
  readonly balance: number;
  readonly version: number;
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

function validateAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidAmountError(amount);
  }
}

/**
 * Reconstruct AccountState by replaying a sequence of events.
 * Events must be ordered by version (ascending).
 */
export function reconstruct(
  accountId: string,
  events: ReadonlyArray<AccountEvent>
): AccountState {
  let balance = 0;
  let version = 0;

  for (const event of events) {
    switch (event.type) {
      case "Deposited":
      case "TransferredIn":
        balance += event.amount;
        break;
      case "Withdrawn":
      case "TransferredOut":
        balance -= event.amount;
        break;
      default: {
        // exhaustive check
        const _exhaustive: never = event;
        throw new UnknownEventError((_exhaustive as AccountEvent).type);
      }
    }
    version = event.version;
  }

  return { accountId, balance, version };
}

// ─── BankAccount Aggregate ───────────────────────────────────────────────────

export class BankAccount {
  private _state: AccountState;
  private _events: AccountEvent[] = [];

  constructor(accountId: string, initialEvents: ReadonlyArray<AccountEvent> = []) {
    this._state = reconstruct(accountId, initialEvents);
    this._events = [...initialEvents];
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  get accountId(): string {
    return this._state.accountId;
  }

  get balance(): number {
    return this._state.balance;
  }

  get version(): number {
    return this._state.version;
  }

  /** All committed events in order. */
  getEvents(): ReadonlyArray<AccountEvent> {
    return [...this._events];
  }

  getState(): AccountState {
    return { ...this._state };
  }

  // ── Private Event Application ─────────────────────────────────────────────

  private nextVersion(): number {
    return this._state.version + 1;
  }

  private apply(event: AccountEvent): void {
    this._events.push(event);
    this._state = reconstruct(this._state.accountId, this._events);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  deposit(amount: number): DepositedEvent {
    validateAmount(amount);

    const event: DepositedEvent = {
      type: "Deposited",
      accountId: this._state.accountId,
      amount,
      timestamp: new Date(),
      version: this.nextVersion(),
    };

    this.apply(event);
    return event;
  }

  withdraw(amount: number): WithdrawnEvent {
    validateAmount(amount);

    if (amount > this._state.balance) {
      throw new InsufficientFundsError(this._state.balance, amount);
    }

    const event: WithdrawnEvent = {
      type: "Withdrawn",
      accountId: this._state.accountId,
      amount,
      timestamp: new Date(),
      version: this.nextVersion(),
    };

    this.apply(event);
    return event;
  }

  /**
   * Transfer produces two events:
   *  - a TransferredOutEvent on this account
   *  - a TransferredInEvent on the target account
   *
   * Both events are returned. The caller is responsible for persisting the
   * TransferredInEvent to the target account's event store.
   */
  transfer(
    toAccount: BankAccount,
    amount: number
  ): { out: TransferredOutEvent; in: TransferredInEvent } {
    validateAmount(amount);

    if (toAccount.accountId === this._state.accountId) {
      throw new SameAccountTransferError(this._state.accountId);
    }

    if (amount > this._state.balance) {
      throw new InsufficientFundsError(this._state.balance, amount);
    }

    const now = new Date();

    const outEvent: TransferredOutEvent = {
      type: "TransferredOut",
      accountId: this._state.accountId,
      amount,
      toAccountId: toAccount.accountId,
      timestamp: now,
      version: this.nextVersion(),
    };

    this.apply(outEvent);

    const inEvent: TransferredInEvent = {
      type: "TransferredIn",
      accountId: toAccount.accountId,
      amount,
      fromAccountId: this._state.accountId,
      timestamp: now,
      version: toAccount.nextVersion(),
    };

    toAccount.apply(inEvent);

    return { out: outEvent, in: inEvent };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a brand-new account with no history. */
export function createAccount(accountId: string): BankAccount {
  if (!accountId || accountId.trim() === "") {
    throw new Error("accountId must be a non-empty string");
  }
  return new BankAccount(accountId);
}

/** Rehydrate an account from a persisted event log. */
export function loadAccount(
  accountId: string,
  events: ReadonlyArray<AccountEvent>
): BankAccount {
  return new BankAccount(accountId, events);
}