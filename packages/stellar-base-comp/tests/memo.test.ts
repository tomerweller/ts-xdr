import { describe, it, expect } from 'vitest';
import { Memo } from '../src/memo.js';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Memo', () => {
  describe('Memo.none()', () => {
    it('creates none memo', () => {
      const m = Memo.none();
      expect(m.type).toBe('none');
      expect(m.value).toBeNull();
    });

    it('roundtrips through XDR', () => {
      const m = Memo.none();
      const xdr = m.toXDRObject();
      const back = Memo.fromXDRObject(xdr);
      expect(back.type).toBe('none');
      expect(back.value).toBeNull();
    });
  });

  describe('Memo.text()', () => {
    it('returns a value for a correct argument', () => {
      expect(() => Memo.text('test')).not.toThrow();
    });

    it('creates text memo', () => {
      const m = Memo.text('hello');
      expect(m.type).toBe('text');
      expect(m.value).toBe('hello');
    });

    it('roundtrips through XDR', () => {
      const m = Memo.text('test');
      const xdr = m.toXDRObject();
      const back = Memo.fromXDRObject(xdr);
      expect(back.type).toBe('text');
      expect(back.value).toBe('test');
    });

    it('throws when string is longer than 28 bytes', () => {
      expect(() => Memo.text('12345678901234567890123456789')).toThrow();
    });

    it('handles UTF-8 encoding (multibyte chars count as multiple bytes)', () => {
      // Japanese characters are 3 bytes each in UTF-8
      // 10 characters * 3 bytes = 30 bytes > 28
      expect(() => Memo.text('三代之時三代之時三代')).toThrow();
    });

    it('allows max 28 bytes', () => {
      expect(() => Memo.text('1234567890123456789012345678')).not.toThrow();
    });
  });

  describe('Memo.id()', () => {
    it('creates id memo with valid string', () => {
      const m = Memo.id('1000');
      expect(m.type).toBe('id');
      expect(m.value).toBe('1000');
    });

    it('accepts 0', () => {
      expect(() => Memo.id('0')).not.toThrow();
      expect(Memo.id('0').value).toBe('0');
    });

    it('accepts large uint64 values', () => {
      expect(() => Memo.id('18446744073709551615')).not.toThrow();
    });

    it('roundtrips through XDR', () => {
      const m = Memo.id('1000');
      const xdr = m.toXDRObject();
      const back = Memo.fromXDRObject(xdr);
      expect(back.type).toBe('id');
      expect(back.value).toBe('1000');
    });

    it('roundtrips large value through modern', () => {
      const m = Memo.id('9223372036854775807');
      const modern = m._toModern();
      const back = Memo._fromModern(modern);
      expect(back.type).toBe('id');
      expect(back.value).toBe('9223372036854775807');
    });

    it('throws on non-numeric string', () => {
      expect(() => Memo.id('test')).toThrow();
    });
  });

  describe('Memo.hash()', () => {
    it('creates hash memo from Uint8Array', () => {
      const hash = new Uint8Array(32);
      hash.fill(10);
      const m = Memo.hash(hash);
      expect(m.type).toBe('hash');
      expect(m.value).toEqual(hash);
    });

    it('creates hash memo from hex string', () => {
      const hex =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const m = Memo.hash(hex);
      expect(m.type).toBe('hash');
      expect((m.value as Uint8Array).length).toBe(32);
    });

    it('throws on invalid length', () => {
      expect(() => Memo.hash(new Uint8Array(16))).toThrow();
      expect(() => Memo.hash(new Uint8Array(33))).toThrow();
    });

    it('throws on invalid hex string length', () => {
      expect(() => Memo.hash('0000')).toThrow();
    });

    it('roundtrips through XDR', () => {
      const hash = new Uint8Array(32);
      hash.fill(0xab);
      const m = Memo.hash(hash);
      const xdr = m.toXDRObject();
      const back = Memo.fromXDRObject(xdr);
      expect(back.type).toBe('hash');
      expect(toHex(back.value as Uint8Array)).toBe(toHex(hash));
    });
  });

  describe('Memo.return()', () => {
    it('creates return memo from Uint8Array', () => {
      const hash = new Uint8Array(32);
      const m = Memo.return(hash);
      expect(m.type).toBe('return');
    });

    it('creates return memo from hex string', () => {
      const hex =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const m = Memo.return(hex);
      expect(m.type).toBe('return');
      expect((m.value as Uint8Array).length).toBe(32);
    });

    it('throws on invalid length', () => {
      expect(() => Memo.return(new Uint8Array(31))).toThrow();
    });

    it('roundtrips through XDR', () => {
      const hash = new Uint8Array(32);
      hash.fill(0xcd);
      const m = Memo.return(hash);
      const xdr = m.toXDRObject();
      const back = Memo.fromXDRObject(xdr);
      expect(back.type).toBe('return');
      expect(toHex(back.value as Uint8Array)).toBe(toHex(hash));
    });
  });

  describe('roundtrip through modern', () => {
    it('roundtrips none', () => {
      const m = Memo.none();
      const back = Memo._fromModern(m._toModern());
      expect(back.type).toBe('none');
    });

    it('roundtrips text', () => {
      const m = Memo.text('world');
      const back = Memo._fromModern(m._toModern());
      expect(back.type).toBe('text');
      expect(back.value).toBe('world');
    });

    it('roundtrips id', () => {
      const m = Memo.id('999');
      const back = Memo._fromModern(m._toModern());
      expect(back.type).toBe('id');
      expect(back.value).toBe('999');
    });

    it('roundtrips hash', () => {
      const hash = new Uint8Array(32);
      hash.fill(0xff);
      const m = Memo.hash(hash);
      const back = Memo._fromModern(m._toModern());
      expect(back.type).toBe('hash');
      expect(toHex(back.value as Uint8Array)).toBe(toHex(hash));
    });

    it('roundtrips return', () => {
      const hash = new Uint8Array(32);
      hash.fill(0x42);
      const m = Memo.return(hash);
      const back = Memo._fromModern(m._toModern());
      expect(back.type).toBe('return');
    });
  });
});
