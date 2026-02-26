import { describe, it, expect } from 'vitest';
import { Address } from '../src/address.js';
import { StrKey } from '../src/strkey.js';

const ACCOUNT = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Address', () => {
  describe('constructor', () => {
    it('fails to create Address from an invalid address', () => {
      expect(() => new Address('GBBB')).toThrow();
    });

    it('creates Address from G-address', () => {
      const addr = new Address(ACCOUNT);
      expect(addr.toString()).toBe(ACCOUNT);
    });

    it('creates Address from C-address', () => {
      const addr = new Address(CONTRACT);
      expect(addr.toString()).toBe(CONTRACT);
    });
  });

  describe('static constructors', () => {
    it('.fromString', () => {
      const a = Address.fromString(ACCOUNT);
      expect(a.toString()).toBe(ACCOUNT);
    });

    it('.fromString with contract', () => {
      const c = Address.fromString(CONTRACT);
      expect(c.toString()).toBe(CONTRACT);
    });
  });

  describe('.fromScAddress', () => {
    it('parses account ScAddress', () => {
      const addr = new Address(ACCOUNT);
      const sc = addr.toScAddress();
      const back = Address.fromScAddress(sc);
      expect(back.toString()).toBe(ACCOUNT);
    });

    it('parses contract ScAddress', () => {
      const addr = new Address(CONTRACT);
      const sc = addr.toScAddress();
      const back = Address.fromScAddress(sc);
      expect(back.toString()).toBe(CONTRACT);
    });
  });

  describe('.toScAddress', () => {
    it('converts account to ScAddress', () => {
      const addr = new Address(ACCOUNT);
      const sc = addr.toScAddress();
      expect('Account' in sc).toBe(true);
    });

    it('converts contract to ScAddress', () => {
      const addr = new Address(CONTRACT);
      const sc = addr.toScAddress();
      expect('Contract' in sc).toBe(true);
    });

    it('roundtrips account through ScAddress', () => {
      const addr = new Address(ACCOUNT);
      const sc = addr.toScAddress();
      const back = Address.fromScAddress(sc);
      expect(back.toString()).toBe(ACCOUNT);
    });

    it('roundtrips contract through ScAddress', () => {
      const addr = new Address(CONTRACT);
      const sc = addr.toScAddress();
      const back = Address.fromScAddress(sc);
      expect(back.toString()).toBe(CONTRACT);
    });
  });

  describe('.toScVal', () => {
    it('wraps account ScAddress in ScVal', () => {
      const addr = new Address(ACCOUNT);
      const scval = addr.toScVal();
      expect('Address' in scval).toBe(true);
    });

    it('wraps contract ScAddress in ScVal', () => {
      const addr = new Address(CONTRACT);
      const scval = addr.toScVal();
      expect('Address' in scval).toBe(true);
    });
  });

  describe('.toBuffer', () => {
    it('returns raw public-key bytes for accounts', () => {
      const addr = new Address(ACCOUNT);
      const buf = addr.toBuffer();
      expect(buf).toBeInstanceOf(Uint8Array);
      expect(buf.length).toBe(32);
      expect(toHex(buf)).toBe(
        toHex(StrKey.decodeEd25519PublicKey(ACCOUNT)),
      );
    });

    it('returns raw hash bytes for contracts', () => {
      const addr = new Address(CONTRACT);
      const buf = addr.toBuffer();
      expect(buf).toBeInstanceOf(Uint8Array);
      expect(buf.length).toBe(32);
      expect(toHex(buf)).toBe(toHex(StrKey.decodeContract(CONTRACT)));
    });
  });
});
