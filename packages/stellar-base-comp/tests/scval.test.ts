import { describe, it, expect } from 'vitest';
import { nativeToScVal, scValToNative } from '../src/scval.js';
import { Address } from '../src/address.js';

const PUBKEY = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

describe('nativeToScVal', () => {
  describe('with explicit type', () => {
    it('bool', () => {
      expect(nativeToScVal(true, { type: 'bool' })).toEqual({ Bool: true });
      expect(nativeToScVal(false, { type: 'bool' })).toEqual({ Bool: false });
    });

    it('void', () => {
      expect(nativeToScVal(null, { type: 'void' })).toBe('Void');
    });

    it('u32', () => {
      expect(nativeToScVal(42, { type: 'u32' })).toEqual({ U32: 42 });
    });

    it('i32', () => {
      expect(nativeToScVal(-10, { type: 'i32' })).toEqual({ I32: -10 });
    });

    it('u64', () => {
      expect(nativeToScVal(100, { type: 'u64' })).toEqual({ U64: 100n });
    });

    it('i64', () => {
      expect(nativeToScVal(-100, { type: 'i64' })).toEqual({ I64: -100n });
    });

    it('string', () => {
      expect(nativeToScVal('hello', { type: 'string' })).toEqual({
        String: 'hello',
      });
    });

    it('symbol', () => {
      expect(nativeToScVal('transfer', { type: 'symbol' })).toEqual({
        Symbol: 'transfer',
      });
    });

    it('bytes from Uint8Array', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(nativeToScVal(bytes, { type: 'bytes' })).toEqual({
        Bytes: bytes,
      });
    });

    it('address from string', () => {
      const result = nativeToScVal(PUBKEY, { type: 'address' });
      expect('Address' in result).toBe(true);
    });

    it('address from Address object', () => {
      const addr = new Address(PUBKEY);
      const result = nativeToScVal(addr, { type: 'address' });
      expect('Address' in result).toBe(true);
    });
  });

  describe('auto-detection', () => {
    it('boolean → Bool', () => {
      expect(nativeToScVal(true)).toEqual({ Bool: true });
    });

    it('positive integer → U32', () => {
      expect(nativeToScVal(42)).toEqual({ U32: 42 });
    });

    it('negative integer → I32', () => {
      expect(nativeToScVal(-5)).toEqual({ I32: -5 });
    });

    it('small bigint → U32', () => {
      expect(nativeToScVal(100n)).toEqual({ U32: 100 });
    });

    it('large bigint → U64', () => {
      expect(nativeToScVal(5000000000n)).toEqual({ U64: 5000000000n });
    });

    it('string → Symbol', () => {
      expect(nativeToScVal('test')).toEqual({ Symbol: 'test' });
    });

    it('Uint8Array → Bytes', () => {
      const b = new Uint8Array([10, 20]);
      expect(nativeToScVal(b)).toEqual({ Bytes: b });
    });

    it('null → Void', () => {
      expect(nativeToScVal(null)).toBe('Void');
    });

    it('undefined → Void', () => {
      expect(nativeToScVal(undefined)).toBe('Void');
    });

    it('array → Vec', () => {
      const result = nativeToScVal([1, 2, 3]);
      expect('Vec' in result).toBe(true);
      expect(result.Vec.length).toBe(3);
    });

    it('object → Map', () => {
      const result = nativeToScVal({ a: 1, b: true });
      expect('Map' in result).toBe(true);
      expect(result.Map.length).toBe(2);
    });

    it('Address → Address ScVal', () => {
      const addr = new Address(PUBKEY);
      const result = nativeToScVal(addr);
      expect('Address' in result).toBe(true);
    });

    it('throws for non-integer number', () => {
      expect(() => nativeToScVal(3.14)).toThrow();
    });
  });
});

describe('scValToNative', () => {
  it('Void → null', () => {
    expect(scValToNative('Void')).toBeNull();
  });

  it('Bool → boolean', () => {
    expect(scValToNative({ Bool: true })).toBe(true);
    expect(scValToNative({ Bool: false })).toBe(false);
  });

  it('U32 → number', () => {
    expect(scValToNative({ U32: 42 })).toBe(42);
  });

  it('I32 → number', () => {
    expect(scValToNative({ I32: -10 })).toBe(-10);
  });

  it('U64 → bigint', () => {
    expect(scValToNative({ U64: 100n })).toBe(100n);
  });

  it('I64 → bigint', () => {
    expect(scValToNative({ I64: -50n })).toBe(-50n);
  });

  it('String → string', () => {
    expect(scValToNative({ String: 'hello' })).toBe('hello');
  });

  it('Symbol → string', () => {
    expect(scValToNative({ Symbol: 'transfer' })).toBe('transfer');
  });

  it('Bytes → Uint8Array', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(scValToNative({ Bytes: bytes })).toEqual(bytes);
  });

  it('Vec → array', () => {
    const result = scValToNative({ Vec: [{ U32: 1 }, { U32: 2 }] });
    expect(result).toEqual([1, 2]);
  });

  it('Map → object', () => {
    const result = scValToNative({
      Map: [
        { key: { Symbol: 'name' }, val: { String: 'test' } },
        { key: { Symbol: 'count' }, val: { U32: 42 } },
      ],
    });
    expect(result).toEqual({ name: 'test', count: 42 });
  });

  it('Address → Address object', () => {
    const scval = new Address(PUBKEY).toScVal();
    const result = scValToNative(scval);
    expect(result).toBeInstanceOf(Address);
    expect(result.toString()).toBe(PUBKEY);
  });

  describe('roundtrip', () => {
    it('bool roundtrips', () => {
      expect(scValToNative(nativeToScVal(true))).toBe(true);
    });

    it('u32 roundtrips', () => {
      expect(scValToNative(nativeToScVal(42))).toBe(42);
    });

    it('string roundtrips', () => {
      expect(scValToNative(nativeToScVal('hello'))).toBe('hello');
    });

    it('null roundtrips', () => {
      expect(scValToNative(nativeToScVal(null))).toBeNull();
    });

    it('array roundtrips', () => {
      expect(scValToNative(nativeToScVal([1, 2, 3]))).toEqual([1, 2, 3]);
    });
  });
});
