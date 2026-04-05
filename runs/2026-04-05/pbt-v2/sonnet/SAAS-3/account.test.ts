import { describe, it, expect } from 'vitest';
import { createAccount, applyEvent, reconstruct, getBalance, AccountError } from './account.js';

const now = Date.now();

describe('SAAS-3: Event-Sourced Account', () => {
  it('deposit increases balance', () => {
    let s = createAccount('a1');
    s = applyEvent(s, { type: 'deposited', amount: 100, timestamp: now });
    expect(getBalance(s)).toBe(100);
  });
  it('withdraw decreases balance', () => {
    let s = createAccount('a1');
    s = applyEvent(s, { type: 'deposited', amount: 100, timestamp: now });
    s = applyEvent(s, { type: 'withdrawn', amount: 30, timestamp: now });
    expect(getBalance(s)).toBe(70);
  });
  it('withdraw fails on insufficient funds', () => {
    let s = createAccount('a1');
    s = applyEvent(s, { type: 'deposited', amount: 50, timestamp: now });
    expect(() => applyEvent(s, { type: 'withdrawn', amount: 100, timestamp: now })).toThrow(AccountError);
  });
  it('transfer deducts', () => {
    let s = createAccount('a1');
    s = applyEvent(s, { type: 'deposited', amount: 200, timestamp: now });
    s = applyEvent(s, { type: 'transferred', amount: 75, toAccount: 'a2', timestamp: now });
    expect(getBalance(s)).toBe(125);
  });
  it('reconstruct from events', () => {
    const events = [
      { type: 'deposited' as const, amount: 1000, timestamp: now },
      { type: 'withdrawn' as const, amount: 200, timestamp: now },
      { type: 'deposited' as const, amount: 50, timestamp: now },
    ];
    const s = reconstruct('a1', events);
    expect(getBalance(s)).toBe(850);
    expect(s.events).toHaveLength(3);
  });
  it('empty events = zero balance', () => {
    const s = reconstruct('a1', []);
    expect(getBalance(s)).toBe(0);
  });
  it('throws on negative deposit', () => {
    const s = createAccount('a1');
    expect(() => applyEvent(s, { type: 'deposited', amount: -10, timestamp: now })).toThrow(AccountError);
  });
  it('balance rounded to 2 decimals', () => {
    let s = createAccount('a1');
    s = applyEvent(s, { type: 'deposited', amount: 33.333, timestamp: now });
    expect(getBalance(s)).toBe(33.33);
  });
});
