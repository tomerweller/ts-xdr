import { describe, it, expect } from 'vitest';
import {
  fixedOpaque,
  varOpaque,
  xdrString,
  fixedArray,
  varArray,
  option,
} from '../src/containers.js';
import { int32, uint32 } from '../src/primitives.js';
import { XdrErrorCode } from '../src/errors.js';

describe('containers', () => {
  describe('fixedOpaque', () => {
    it('roundtrips 4 bytes', () => {
      const codec = fixedOpaque(4);
      const data = new Uint8Array([1, 2, 3, 4]);
      expect(codec.fromXdr(codec.toXdr(data))).toEqual(data);
    });

    it('roundtrips with padding (3 bytes)', () => {
      const codec = fixedOpaque(3);
      const data = new Uint8Array([0xaa, 0xbb, 0xcc]);
      const xdr = codec.toXdr(data);
      // 3 data bytes + 1 padding = 4 bytes
      expect(xdr.length).toBe(4);
      expect(codec.fromXdr(xdr)).toEqual(data);
    });

    it('roundtrips with padding (1 byte)', () => {
      const codec = fixedOpaque(1);
      const data = new Uint8Array([0xff]);
      const xdr = codec.toXdr(data);
      expect(xdr.length).toBe(4);
      expect(codec.fromXdr(xdr)).toEqual(data);
    });

    it('roundtrips empty (0 bytes)', () => {
      const codec = fixedOpaque(0);
      const data = new Uint8Array([]);
      expect(codec.fromXdr(codec.toXdr(data))).toEqual(data);
    });

    it('rejects wrong length', () => {
      const codec = fixedOpaque(4);
      expect(() => codec.toXdr(new Uint8Array([1, 2, 3]))).toThrow(
        XdrErrorCode.LengthMismatch,
      );
    });
  });

  describe('varOpaque', () => {
    it('roundtrips empty', () => {
      const codec = varOpaque(100);
      const data = new Uint8Array([]);
      expect(codec.fromXdr(codec.toXdr(data))).toEqual(data);
    });

    it('roundtrips data with padding', () => {
      const codec = varOpaque(100);
      const data = new Uint8Array([1, 2, 3]);
      const xdr = codec.toXdr(data);
      // 4 (length) + 3 (data) + 1 (padding) = 8
      expect(xdr.length).toBe(8);
      expect(codec.fromXdr(xdr)).toEqual(data);
    });

    it('rejects data exceeding max on encode', () => {
      const codec = varOpaque(2);
      expect(() => codec.toXdr(new Uint8Array([1, 2, 3]))).toThrow(
        XdrErrorCode.LengthExceedsMax,
      );
    });

    it('roundtrips without max length', () => {
      const codec = varOpaque();
      const data = new Uint8Array(100);
      data.fill(0x42);
      expect(codec.fromXdr(codec.toXdr(data))).toEqual(data);
    });
  });

  describe('xdrString', () => {
    it('roundtrips ASCII', () => {
      const codec = xdrString(100);
      expect(codec.fromXdr(codec.toXdr('hello'))).toBe('hello');
    });

    it('roundtrips empty string', () => {
      const codec = xdrString(100);
      expect(codec.fromXdr(codec.toXdr(''))).toBe('');
    });

    it('roundtrips UTF-8', () => {
      const codec = xdrString(100);
      expect(codec.fromXdr(codec.toXdr('héllo wörld'))).toBe('héllo wörld');
    });

    it('rejects string exceeding max', () => {
      const codec = xdrString(3);
      expect(() => codec.toXdr('hello')).toThrow(
        XdrErrorCode.LengthExceedsMax,
      );
    });

    it('base64 roundtrip', () => {
      const codec = xdrString(100);
      const b64 = codec.toBase64('Stellar');
      expect(codec.fromBase64(b64)).toBe('Stellar');
    });
  });

  describe('fixedArray', () => {
    it('roundtrips array of int32', () => {
      const codec = fixedArray(3, int32);
      const data = [10, 20, 30] as const;
      expect(codec.fromXdr(codec.toXdr(data))).toEqual([10, 20, 30]);
    });

    it('rejects wrong length array', () => {
      const codec = fixedArray(3, int32);
      expect(() => codec.toXdr([1, 2])).toThrow(XdrErrorCode.LengthMismatch);
    });

    it('roundtrips empty array', () => {
      const codec = fixedArray(0, int32);
      expect(codec.fromXdr(codec.toXdr([]))).toEqual([]);
    });
  });

  describe('varArray', () => {
    it('roundtrips array of int32', () => {
      const codec = varArray(10, int32);
      const data = [1, 2, 3];
      expect(codec.fromXdr(codec.toXdr(data))).toEqual([1, 2, 3]);
    });

    it('roundtrips empty array', () => {
      const codec = varArray(10, int32);
      expect(codec.fromXdr(codec.toXdr([]))).toEqual([]);
    });

    it('rejects array exceeding max', () => {
      const codec = varArray(2, int32);
      expect(() => codec.toXdr([1, 2, 3])).toThrow(
        XdrErrorCode.LengthExceedsMax,
      );
    });

    it('nested varOpaque in varArray', () => {
      const codec = varArray(5, varOpaque(10));
      const data = [
        new Uint8Array([1, 2]),
        new Uint8Array([3, 4, 5]),
      ];
      const result = codec.fromXdr(codec.toXdr(data));
      expect(result).toEqual(data);
    });
  });

  describe('option', () => {
    it('roundtrips present value', () => {
      const codec = option(int32);
      expect(codec.fromXdr(codec.toXdr(42))).toBe(42);
    });

    it('roundtrips absent value', () => {
      const codec = option(int32);
      expect(codec.fromXdr(codec.toXdr(null))).toBeNull();
    });

    it('encodes None as 0x00000000', () => {
      const codec = option(int32);
      const xdr = codec.toXdr(null);
      expect(xdr).toEqual(new Uint8Array([0, 0, 0, 0]));
    });

    it('encodes Some as 0x00000001 + value', () => {
      const codec = option(uint32);
      const xdr = codec.toXdr(7);
      // bool true (4 bytes) + uint32 7 (4 bytes) = 8 bytes
      expect(xdr).toEqual(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 7]));
    });
  });
});
