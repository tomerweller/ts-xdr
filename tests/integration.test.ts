import { describe, it, expect } from 'vitest';
import {
  int32,
  uint32,
  uint64,
  bool,
  xdrVoid,
  fixedOpaque,
  varOpaque,
  xdrString,
  fixedArray,
  varArray,
  option,
  xdrStruct,
  xdrEnum,
  taggedUnion,
  is,
  XdrError,
  XdrErrorCode,
  encodeBase64,
  decodeBase64,
  type XdrCodec,
} from '../src/index.js';

describe('integration', () => {
  // Simulate generated Stellar types

  const AssetType = xdrEnum({
    native: 0,
    credit_alphanum4: 1,
    credit_alphanum12: 2,
  });

  interface AlphaNum4 {
    readonly asset_code: Uint8Array;
    readonly issuer: Uint8Array;
  }
  const AlphaNum4: XdrCodec<AlphaNum4> = xdrStruct<AlphaNum4>([
    ['asset_code', fixedOpaque(4)],
    ['issuer', fixedOpaque(32)],
  ]);

  interface AlphaNum12 {
    readonly asset_code: Uint8Array;
    readonly issuer: Uint8Array;
  }
  const AlphaNum12: XdrCodec<AlphaNum12> = xdrStruct<AlphaNum12>([
    ['asset_code', fixedOpaque(12)],
    ['issuer', fixedOpaque(32)],
  ]);

  type Asset =
    | 'native'
    | { readonly credit_alphanum4: AlphaNum4 }
    | { readonly credit_alphanum12: AlphaNum12 };

  const Asset: XdrCodec<Asset> = taggedUnion({
    switchOn: AssetType,
    arms: [
      { tags: ['native'] },
      { tags: ['credit_alphanum4'], codec: AlphaNum4 },
      { tags: ['credit_alphanum12'], codec: AlphaNum12 },
    ],
  }) as XdrCodec<Asset>;

  describe('Asset union', () => {
    it('roundtrips native', () => {
      const native: Asset = 'native';
      const xdr = Asset.toXdr(native);
      const decoded = Asset.fromXdr(xdr);
      expect(decoded).toBe('native');
    });

    it('roundtrips credit_alphanum4', () => {
      const usdc: Asset = {
        credit_alphanum4: {
          asset_code: new Uint8Array([85, 83, 68, 67]), // USDC
          issuer: new Uint8Array(32),
        },
      };
      const decoded = Asset.fromXdr(Asset.toXdr(usdc));
      expect(is(decoded, 'credit_alphanum4')).toBe(true);
      if (is(decoded, 'credit_alphanum4')) {
        expect(decoded.credit_alphanum4.asset_code).toEqual(
          new Uint8Array([85, 83, 68, 67]),
        );
      }
    });

    it('base64 roundtrip', () => {
      const native: Asset = 'native';
      const b64 = Asset.toBase64(native);
      expect(Asset.fromBase64(b64)).toBe('native');
    });
  });

  describe('enum access pattern', () => {
    it('enum has numeric members', () => {
      expect(AssetType.native).toBe(0);
      expect(AssetType.credit_alphanum4).toBe(1);
      expect(AssetType.credit_alphanum12).toBe(2);
    });

    it('enum encodes/decodes string names', () => {
      expect(AssetType.fromXdr(AssetType.toXdr('native'))).toBe('native');
    });
  });

  describe('typedef pattern', () => {
    // typedef opaque Hash[32]
    type Hash = Uint8Array;
    const Hash: XdrCodec<Hash> = fixedOpaque(32);

    // typedef uint64 TimePoint
    type TimePoint = bigint;
    const TimePoint: XdrCodec<TimePoint> = uint64;

    it('Hash roundtrip', () => {
      const hash = new Uint8Array(32);
      hash.fill(0xab);
      expect(Hash.fromXdr(Hash.toXdr(hash))).toEqual(hash);
    });

    it('TimePoint roundtrip', () => {
      const tp: TimePoint = 1234567890n;
      expect(TimePoint.fromXdr(TimePoint.toXdr(tp))).toBe(tp);
    });
  });

  describe('complex struct', () => {
    const MAX_SIGNERS = 20;

    interface Signer {
      readonly key: Uint8Array;
      readonly weight: number;
    }
    const Signer: XdrCodec<Signer> = xdrStruct<Signer>([
      ['key', fixedOpaque(32)],
      ['weight', uint32],
    ]);

    interface AccountEntry {
      readonly account_id: Uint8Array;
      readonly balance: bigint;
      readonly signers: readonly Signer[];
    }
    const AccountEntry: XdrCodec<AccountEntry> = xdrStruct<AccountEntry>([
      ['account_id', fixedOpaque(32)],
      ['balance', uint64],
      ['signers', varArray(MAX_SIGNERS, Signer)],
    ]);

    it('roundtrips complex struct', () => {
      const entry: AccountEntry = {
        account_id: new Uint8Array(32).fill(0x01),
        balance: 10000000n,
        signers: [
          { key: new Uint8Array(32).fill(0x02), weight: 1 },
          { key: new Uint8Array(32).fill(0x03), weight: 2 },
        ],
      };
      const decoded = AccountEntry.fromXdr(AccountEntry.toXdr(entry));
      expect(decoded.account_id).toEqual(entry.account_id);
      expect(decoded.balance).toBe(entry.balance);
      expect(decoded.signers.length).toBe(2);
      expect(decoded.signers[0]!.weight).toBe(1);
      expect(decoded.signers[1]!.weight).toBe(2);
    });
  });

  describe('error handling', () => {
    it('XdrError has correct code', () => {
      try {
        int32.fromXdr(new Uint8Array([0, 0]));
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(XdrError);
        expect((err as XdrError).code).toBe(XdrErrorCode.BufferUnderflow);
      }
    });

    it('rejects extra trailing bytes', () => {
      expect(() =>
        uint32.fromXdr(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2])),
      ).toThrow(XdrErrorCode.BufferNotFullyConsumed);
    });
  });

  describe('limits', () => {
    it('rejects on byte limit exceeded', () => {
      expect(() =>
        int32.fromXdr(new Uint8Array([0, 0, 0, 1]), { depth: 512, len: 2 }),
      ).toThrow(XdrErrorCode.ByteLimitExceeded);
    });

    it('rejects deeply nested structs', () => {
      // Create a chain of structs 3 deep but with depth limit 2
      interface Inner {
        readonly x: number;
      }
      interface Middle {
        readonly inner: Inner;
      }
      interface Outer {
        readonly middle: Middle;
      }
      const Inner: XdrCodec<Inner> = xdrStruct<Inner>([['x', int32]]);
      const Middle: XdrCodec<Middle> = xdrStruct<Middle>([
        ['inner', Inner],
      ]);
      const Outer: XdrCodec<Outer> = xdrStruct<Outer>([
        ['middle', Middle],
      ]);

      const val: Outer = { middle: { inner: { x: 42 } } };
      // Should succeed with default limits
      expect(Outer.fromXdr(Outer.toXdr(val))).toEqual(val);
      // Should fail with depth=2 (Outer->Middle->Inner = 3 nesting levels)
      expect(() =>
        Outer.fromXdr(Outer.toXdr(val), { depth: 2, len: 256 * 1024 * 1024 }),
      ).toThrow(XdrErrorCode.DepthLimitExceeded);
    });
  });

  describe('base64 utilities', () => {
    it('roundtrips', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      expect(decodeBase64(encodeBase64(data))).toEqual(data);
    });

    it('handles whitespace in base64 input', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const b64 = encodeBase64(data);
      // Add whitespace
      const withWhitespace = ' ' + b64.slice(0, 2) + '\n' + b64.slice(2) + ' ';
      expect(decodeBase64(withWhitespace)).toEqual(data);
    });
  });

  describe('edge cases from rs-stellar-xdr', () => {
    it('two uint32s concatenated: fails as uint32, succeeds as uint64', () => {
      const twoU32s = new Uint8Array([
        ...uint32.toXdr(1),
        ...uint32.toXdr(2),
      ]);
      expect(() => uint32.fromXdr(twoU32s)).toThrow(
        XdrErrorCode.BufferNotFullyConsumed,
      );
      // As uint64: (1 << 32) | 2 = 4294967298
      expect(uint64.fromXdr(twoU32s)).toBe((1n << 32n) | 2n);
    });

    it('empty buffer fails for int32', () => {
      expect(() => int32.fromXdr(new Uint8Array([]))).toThrow(
        XdrErrorCode.BufferUnderflow,
      );
    });

    it('default uint32 is 0', () => {
      expect(uint32.fromXdr(new Uint8Array([0, 0, 0, 0]))).toBe(0);
    });
  });

  describe('JSON methods', () => {
    it('struct toJson/fromJson roundtrip', () => {
      interface Point {
        readonly x: number;
        readonly y: number;
      }
      const Point = xdrStruct<Point>([
        ['x', int32],
        ['y', int32],
      ]);
      const val: Point = { x: 10, y: 20 };
      const json = Point.toJson(val);
      expect(Point.fromJson(json)).toEqual(val);
    });

    it('bigint serializes as string in JSON', () => {
      const val = 123456789012345n;
      const json = uint64.toJson(val);
      expect(json).toBe('"123456789012345"');
      expect(uint64.fromJson(json)).toBe(val);
    });

    it('opaque serializes as hex in JSON', () => {
      const codec = fixedOpaque(4);
      const val = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const jsonVal = codec.toJsonValue(val);
      expect(jsonVal).toBe('deadbeef');
    });

    it('option null in JSON', () => {
      const codec = option(int32);
      expect(codec.toJsonValue(null)).toBeNull();
      expect(codec.fromJsonValue(null)).toBeNull();
      expect(codec.toJsonValue(42)).toBe(42);
      expect(codec.fromJsonValue(42)).toBe(42);
    });

    it('Asset union JSON roundtrip', () => {
      const nativeJson = Asset.toJson('native');
      expect(Asset.fromJson(nativeJson)).toBe('native');

      const usdc: Asset = {
        credit_alphanum4: {
          asset_code: new Uint8Array([85, 83, 68, 67]),
          issuer: new Uint8Array(32),
        },
      };
      const usdcJson = Asset.toJson(usdc);
      const restored = Asset.fromJson(usdcJson);
      expect(is(restored, 'credit_alphanum4')).toBe(true);
      if (is(restored, 'credit_alphanum4')) {
        expect(restored.credit_alphanum4.asset_code).toEqual(
          new Uint8Array([85, 83, 68, 67]),
        );
      }
    });
  });
});
