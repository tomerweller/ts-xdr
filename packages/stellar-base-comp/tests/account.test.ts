import { describe, it, expect } from 'vitest';
import { Account, MuxedAccount } from '../src/account.js';

const ACCOUNT = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const MUXED_ADDRESS =
  'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK';

describe('Account.constructor', () => {
  it('creates an Account object', () => {
    const account = new Account(ACCOUNT, '100');
    expect(account.accountId()).toBe(ACCOUNT);
    expect(account.sequenceNumber()).toBe('100');
  });

  it('fails to create Account from an invalid address', () => {
    expect(() => new Account('GBBB', '100')).toThrow(/accountId is invalid/);
  });

  it('fails to create Account from an invalid sequence number', () => {
    expect(() => new Account(ACCOUNT, 100 as any)).toThrow(
      /sequence must be of type string/,
    );
  });

  it('fails to create Account from a non-numeric sequence string', () => {
    expect(() => new Account(ACCOUNT, 'not a number')).toThrow();
  });

  it('rejects muxed account strings', () => {
    expect(() => new Account(MUXED_ADDRESS, '123')).toThrow(/MuxedAccount/);
  });
});

describe('Account.incrementSequenceNumber', () => {
  it('correctly increments the sequence number', () => {
    const account = new Account(ACCOUNT, '100');
    account.incrementSequenceNumber();
    expect(account.sequenceNumber()).toBe('101');
    account.incrementSequenceNumber();
    account.incrementSequenceNumber();
    expect(account.sequenceNumber()).toBe('103');
  });
});

describe('MuxedAccount', () => {
  it('shares sequence numbers with base account', () => {
    const base = new Account(ACCOUNT, '100');
    const muxed = new MuxedAccount(base, '42');

    expect(muxed.sequenceNumber()).toBe('100');
    muxed.incrementSequenceNumber();
    expect(muxed.sequenceNumber()).toBe('101');
    expect(base.sequenceNumber()).toBe('101');
  });

  it('returns the id', () => {
    const base = new Account(ACCOUNT, '0');
    const muxed = new MuxedAccount(base, '9223372036854775808');
    expect(muxed.id()).toBe('9223372036854775808');
  });

  it('returns the base account', () => {
    const base = new Account(ACCOUNT, '0');
    const muxed = new MuxedAccount(base, '1');
    expect(muxed.baseAccount()).toBe(base);
  });

  it('multiple muxed accounts from same base share sequence', () => {
    const base = new Account(ACCOUNT, '50');
    const m1 = new MuxedAccount(base, '1');
    const m2 = new MuxedAccount(base, '2');

    m1.incrementSequenceNumber();
    expect(m1.sequenceNumber()).toBe('51');
    expect(m2.sequenceNumber()).toBe('51');
    expect(base.sequenceNumber()).toBe('51');
  });
});
