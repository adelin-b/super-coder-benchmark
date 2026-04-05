/** BUG: No validation on negative/zero amounts */
export type Event = | { type: 'deposited'; amount: number; timestamp: number } | { type: 'withdrawn'; amount: number; timestamp: number } | { type: 'transferred'; amount: number; toAccount: string; timestamp: number };
export interface AccountState { id: string; balance: number; events: Event[]; }
export class AccountError extends Error { constructor(m: string) { super(m); this.name = 'AccountError'; } }
function r2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function createAccount(id: string): AccountState { return { id, balance: 0, events: [] }; }
export function applyEvent(state: AccountState, event: Event): AccountState {
  const newState = { ...state, events: [...state.events, event] };
  switch (event.type) {
    case 'deposited':
      // BUG: no positive check
      newState.balance = r2(state.balance + event.amount);
      break;
    case 'withdrawn':
      // BUG: no positive check
      if (event.amount > state.balance) throw new AccountError('Insufficient funds');
      newState.balance = r2(state.balance - event.amount);
      break;
    case 'transferred':
      // BUG: no positive check
      if (event.amount > state.balance) throw new AccountError('Insufficient funds for transfer');
      newState.balance = r2(state.balance - event.amount);
      break;
  }
  return newState;
}
export function reconstruct(id: string, events: Event[]): AccountState { return events.reduce((state, event) => applyEvent(state, event), createAccount(id)); }
export function getBalance(state: AccountState): number { return state.balance; }
