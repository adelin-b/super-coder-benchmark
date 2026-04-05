// account.ts

// ── Event types ──────────────────────────────────────────────────────────────

export type EventType =
  | "AccountOpened"
  | "Deposited"
  | "Withdrawn"
  | "TransferSent"
  | "TransferReceived";

export interface BaseEvent {
  readonly type: EventType;
  readonly accountId: string;
  readonly timestamp: Date;
  readonly eventId: string;
}

export interface AccountOpenedEvent extends BaseEvent {
  readonly type: "AccountOpened";
  readonly initialBalance: number;
}

export interface DepositedEvent extends BaseEvent {
  readonly type: "Deposited";
  readonly amount: number;
}

export interface WithdrawnEvent extends BaseEvent {
  readonly type: "Withdrawn";
  readonly amount: number;
}

export interface TransferSentEvent extends BaseEvent {
  readonly type: "TransferSent";
  readonly amount: number;
  readonly toAccountId: string;
}

export interface TransferReceivedEvent extends BaseEvent {
  readonly type: "TransferReceived";
  readonly amount: number;
  readonly fromAccountId: string;
}

export type AccountEvent =
  | AccountOpenedEvent
  | DepositedEvent
  | WithdrawnEvent
  | TransferSentEvent
  | TransferReceivedEvent;

// ── Account state ─────────────────────────────────────────────────────────────

export interface AccountState {
  readonly accountId: string;
  readonly balance: number;
  readonly isOpen: boolean;
  readonly events: ReadonlyArray<AccountEvent>;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

export class InsufficientFundsError extends AccountError {
  constructor(balance: number, requested: number) {
    super(
      `Insufficient funds: balance is ${balance}, requested ${requested}`
    );
    this.name = "InsufficientFundsError";
  }
}

export class AccountClosedError extends AccountError {
  constructor(accountId: string) {
    super(`Account ${accountId} is closed`);
    this.name = "AccountClosedError";
  }
}

export class InvalidAmountError extends AccountError {
  constructor(amount: number) {
    super(`Invalid amount: ${amount}. Amount must be positive`);
    this.name = "InvalidAmountError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _eventCounter = 0;

function makeEventId(): string {
  return `evt_${Date.now()}_${++_eventCounter}`;
}

// ── State reconstruction (apply) ──────────────────────────────────────────────

function applyEvent(state: AccountState, event: AccountEvent): AccountState {
  switch (event.type) {
    case "AccountOpened":
      return {
        ...state,
        accountId: event.accountId,
        balance: event.initialBalance,
        isOpen: true,
      };

    case "Deposited":
      return { ...state, balance: state.balance + event.amount };

    case "Withdrawn":
      return { ...state, balance: state.balance - event.amount };

    case "TransferSent":
      return { ...state, balance: state.balance - event.amount };

    case "TransferReceived":
      return { ...state, balance: state.balance + event.amount };

    default: {
      const _exhaustive: never = event;
      return state;
    }
  }
}

export function reconstruct(events: ReadonlyArray<AccountEvent>): AccountState {
  const initial: AccountState = {
    accountId: "",
    balance: 0,
    isOpen: false,
    events: [],
  };

  return events.reduce<AccountState>(
    (state, event) => ({
      ...applyEvent(state, event),
      events: [...state.events, event],
    }),
    initial
  );
}

// ── Command functions ─────────────────────────────────────────────────────────

export function openAccount(
  accountId: string,
  initialBalance = 0
): AccountState {
  if (initialBalance < 0) {
    throw new InvalidAmountError(initialBalance);
  }

  const event: AccountOpenedEvent = {
    type: "AccountOpened",
    accountId,
    initialBalance,
    timestamp: new Date(),
    eventId: makeEventId(),
  };

  return reconstruct([event]);
}

export function deposit(state: AccountState, amount: number): AccountState {
  if (!state.isOpen) throw new AccountClosedError(state.accountId);
  if (amount <= 0) throw new InvalidAmountError(amount);

  const event: DepositedEvent = {
    type: "Deposited",
    accountId: state.accountId,
    amount,
    timestamp: new Date(),
    eventId: makeEventId(),
  };

  return {
    ...applyEvent(state, event),
    events: [...state.events, event],
  };
}

export function withdraw(state: AccountState, amount: number): AccountState {
  if (!state.isOpen) throw new AccountClosedError(state.accountId);
  if (amount <= 0) throw new InvalidAmountError(amount);
  if (state.balance < amount)
    throw new InsufficientFundsError(state.balance, amount);

  const event: WithdrawnEvent = {
    type: "Withdrawn",
    accountId: state.accountId,
    amount,
    timestamp: new Date(),
    eventId: makeEventId(),
  };

  return {
    ...applyEvent(state, event),
    events: [...state.events, event],
  };
}

export interface TransferResult {
  readonly sender: AccountState;
  readonly recipient: AccountState;
}

export function transfer(
  sender: AccountState,
  recipient: AccountState,
  amount: number
): TransferResult {
  if (!sender.isOpen) throw new AccountClosedError(sender.accountId);
  if (!recipient.isOpen) throw new AccountClosedError(recipient.accountId);
  if (amount <= 0) throw new InvalidAmountError(amount);
  if (sender.balance < amount)
    throw new InsufficientFundsError(sender.balance, amount);

  const now = new Date();

  const sentEvent: TransferSentEvent = {
    type: "TransferSent",
    accountId: sender.accountId,
    amount,
    toAccountId: recipient.accountId,
    timestamp: now,
    eventId: makeEventId(),
  };

  const receivedEvent: TransferReceivedEvent = {
    type: "TransferReceived",
    accountId: recipient.accountId,
    amount,
    fromAccountId: sender.accountId,
    timestamp: now,
    eventId: makeEventId(),
  };

  return {
    sender: {
      ...applyEvent(sender, sentEvent),
      events: [...sender.events, sentEvent],
    },
    recipient: {
      ...applyEvent(recipient, receivedEvent),
      events: [...recipient.events, receivedEvent],
    },
  };
}

export function getBalance(state: AccountState): number {
  return state.balance;
}

export function getHistory(state: AccountState): ReadonlyArray<AccountEvent> {
  return state.events;
}