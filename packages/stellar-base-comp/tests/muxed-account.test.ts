import { describe, it, expect } from 'vitest';
import { Account, MuxedAccount } from '../src/account.js';

const PUBKEY = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

describe('MuxedAccount', () => {
  it('shares base account reference', () => {
    const base = new Account(PUBKEY, '1');
    const mux = new MuxedAccount(base, '0');
    expect(mux.baseAccount()).toBe(base);
    expect(mux.baseAccount().accountId()).toBe(PUBKEY);
    expect(mux.id()).toBe('0');
  });

  it('tracks sequence numbers correctly', () => {
    const base = new Account(PUBKEY, '12345');
    const mux1 = new MuxedAccount(base, '1');
    const mux2 = new MuxedAccount(base, '2');

    expect(base.sequenceNumber()).toBe('12345');
    expect(mux1.sequenceNumber()).toBe('12345');
    expect(mux2.sequenceNumber()).toBe('12345');

    mux1.incrementSequenceNumber();

    expect(base.sequenceNumber()).toBe('12346');
    expect(mux1.sequenceNumber()).toBe('12346');
    expect(mux2.sequenceNumber()).toBe('12346');

    mux2.incrementSequenceNumber();

    expect(base.sequenceNumber()).toBe('12347');
    expect(mux1.sequenceNumber()).toBe('12347');
    expect(mux2.sequenceNumber()).toBe('12347');

    base.incrementSequenceNumber();

    expect(base.sequenceNumber()).toBe('12348');
    expect(mux1.sequenceNumber()).toBe('12348');
    expect(mux2.sequenceNumber()).toBe('12348');
  });

  it('lets virtual accounts be created', () => {
    const base = new Account(PUBKEY, '12345');
    const mux1 = new MuxedAccount(base, '1');
    const mux2 = new MuxedAccount(mux1.baseAccount(), '420');

    expect(mux2.id()).toBe('420');
    expect(mux2.sequenceNumber()).toBe('12345');

    const mux3 = new MuxedAccount(mux2.baseAccount(), '3');

    mux2.incrementSequenceNumber();
    expect(mux1.sequenceNumber()).toBe('12346');
    expect(mux2.sequenceNumber()).toBe('12346');
    expect(mux3.sequenceNumber()).toBe('12346');
  });

  it('has separate ids', () => {
    const base = new Account(PUBKEY, '0');
    const mux0 = new MuxedAccount(base, '0');
    const mux420 = new MuxedAccount(base, '420');

    expect(mux0.id()).toBe('0');
    expect(mux420.id()).toBe('420');
  });

  it('handles large uint64 ids', () => {
    const base = new Account(PUBKEY, '0');
    const mux = new MuxedAccount(base, '9223372036854775808');
    expect(mux.id()).toBe('9223372036854775808');
  });
});
