import { describe, it, expect } from 'vitest';
import { xdrStruct, xdrEnum, taggedUnion, is } from '../src/composites.js';
import { int32, uint32, bool } from '../src/primitives.js';
import { varOpaque, xdrString, option } from '../src/containers.js';
import { XdrErrorCode } from '../src/errors.js';

describe('composites', () => {
  describe('xdrStruct', () => {
    it('roundtrips simple struct', () => {
      interface Price {
        readonly n: number;
        readonly d: number;
      }
      const Price = xdrStruct<Price>([
        ['n', int32],
        ['d', int32],
      ]);
      const val: Price = { n: 1, d: 2 };
      expect(Price.fromXdr(Price.toXdr(val))).toEqual(val);
    });

    it('roundtrips struct with optional field', () => {
      interface Foo {
        readonly x: number;
        readonly y: number | null;
      }
      const Foo = xdrStruct<Foo>([
        ['x', int32],
        ['y', option(int32)],
      ]);
      expect(Foo.fromXdr(Foo.toXdr({ x: 1, y: 42 }))).toEqual({
        x: 1,
        y: 42,
      });
      expect(Foo.fromXdr(Foo.toXdr({ x: 1, y: null }))).toEqual({
        x: 1,
        y: null,
      });
    });

    it('roundtrips nested structs', () => {
      interface Inner {
        readonly val: number;
      }
      interface Outer {
        readonly a: number;
        readonly inner: Inner;
      }
      const Inner = xdrStruct<Inner>([['val', int32]]);
      const Outer = xdrStruct<Outer>([
        ['a', int32],
        ['inner', Inner],
      ]);
      const data: Outer = { a: 10, inner: { val: 20 } };
      expect(Outer.fromXdr(Outer.toXdr(data))).toEqual(data);
    });

    it('encodes fields sequentially in big-endian', () => {
      interface Pair {
        readonly x: number;
        readonly y: number;
      }
      const Pair = xdrStruct<Pair>([
        ['x', uint32],
        ['y', uint32],
      ]);
      const xdr = Pair.toXdr({ x: 1, y: 2 });
      expect(xdr).toEqual(
        new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]),
      );
    });
  });

  describe('xdrEnum', () => {
    it('has member properties', () => {
      const Color = xdrEnum({ red: 0, green: 1, blue: 2 });
      expect(Color.red).toBe(0);
      expect(Color.green).toBe(1);
      expect(Color.blue).toBe(2);
    });

    it('roundtrips enum values', () => {
      const Color = xdrEnum({ red: 0, green: 1, blue: 2 });
      expect(Color.fromXdr(Color.toXdr('red'))).toBe('red');
      expect(Color.fromXdr(Color.toXdr('green'))).toBe('green');
      expect(Color.fromXdr(Color.toXdr('blue'))).toBe('blue');
    });

    it('encodes as int32', () => {
      const Color = xdrEnum({ red: 0, green: 1, blue: 2 });
      expect(Color.toXdr('green')).toEqual(new Uint8Array([0, 0, 0, 1]));
    });

    it('rejects unknown enum name on encode', () => {
      const Color = xdrEnum({ red: 0, green: 1 });
      expect(() => Color.toXdr('blue' as any)).toThrow(
        XdrErrorCode.InvalidEnumValue,
      );
    });

    it('rejects unknown numeric value on decode', () => {
      const Color = xdrEnum({ red: 0, green: 1 });
      const xdr = int32.toXdr(99);
      expect(() => Color.fromXdr(xdr)).toThrow(XdrErrorCode.InvalidEnumValue);
    });

    it('handles non-contiguous values', () => {
      const Flags = xdrEnum({ A: 0, B: 5, C: 10 });
      expect(Flags.fromXdr(Flags.toXdr('B'))).toBe('B');
    });

    it('base64 roundtrip', () => {
      const Color = xdrEnum({ red: 0, green: 1, blue: 2 });
      const b64 = Color.toBase64('blue');
      expect(Color.fromBase64(b64)).toBe('blue');
    });
  });

  describe('taggedUnion', () => {
    describe('enum-discriminated', () => {
      const AssetType = xdrEnum({
        native: 0,
        credit_alphanum4: 1,
      });

      interface AlphaNum4 {
        readonly asset_code: Uint8Array;
      }

      const AlphaNum4 = xdrStruct<AlphaNum4>([
        ['asset_code', varOpaque(4)],
      ]);

      type Asset =
        | 'native'
        | { readonly credit_alphanum4: AlphaNum4 };

      const Asset = taggedUnion({
        switchOn: AssetType,
        arms: [
          { tags: ['native'] },
          { tags: ['credit_alphanum4'], codec: AlphaNum4 },
        ],
      }) as import('../src/codec.js').XdrCodec<Asset>;

      it('roundtrips void arm', () => {
        const val: Asset = 'native';
        const result = Asset.fromXdr(Asset.toXdr(val));
        expect(result).toBe('native');
      });

      it('roundtrips value arm', () => {
        const val: Asset = {
          credit_alphanum4: { asset_code: new Uint8Array([85, 83, 68, 67]) },
        };
        const result = Asset.fromXdr(Asset.toXdr(val));
        expect(typeof result).toBe('object');
        expect(
          (result as { credit_alphanum4: AlphaNum4 }).credit_alphanum4
            .asset_code,
        ).toEqual(new Uint8Array([85, 83, 68, 67]));
      });
    });

    describe('int-discriminated', () => {
      type Ext =
        | 'v0'
        | { readonly v1: number };

      const Ext = taggedUnion({
        switchOn: int32,
        arms: [
          { tags: [0], key: 'v0' },
          { tags: [1], key: 'v1', codec: uint32 },
        ],
      }) as import('../src/codec.js').XdrCodec<Ext>;

      it('roundtrips void arm', () => {
        const val: Ext = 'v0';
        const result = Ext.fromXdr(Ext.toXdr(val));
        expect(result).toBe('v0');
      });

      it('roundtrips value arm', () => {
        const val: Ext = { v1: 999 };
        const result = Ext.fromXdr(Ext.toXdr(val));
        expect(result).toEqual({ v1: 999 });
      });
    });

    describe('default arm', () => {
      type MyUnion =
        | 'v0'
        | { readonly [key: string]: Uint8Array };

      const MyUnion = taggedUnion({
        switchOn: int32,
        arms: [{ tags: [0], key: 'v0' }],
        defaultArm: { codec: varOpaque(100) },
      }) as import('../src/codec.js').XdrCodec<MyUnion>;

      it('roundtrips known arm', () => {
        const val: MyUnion = 'v0';
        expect(MyUnion.fromXdr(MyUnion.toXdr(val))).toBe('v0');
      });

      it('roundtrips default arm', () => {
        const val = { '42': new Uint8Array([1, 2, 3]) };
        const result = MyUnion.fromXdr(MyUnion.toXdr(val));
        expect(typeof result).toBe('object');
        expect((result as any)['42']).toEqual(new Uint8Array([1, 2, 3]));
      });
    });

    describe('void default arm', () => {
      const U = taggedUnion({
        switchOn: int32,
        arms: [{ tags: [0], key: 'v0', codec: uint32 }],
        defaultArm: {},
      });

      it('default arm with no codec produces void', () => {
        const result = U.fromXdr(U.toXdr('99'));
        expect(result).toBe('99');
      });
    });

    it('rejects unknown discriminant without default', () => {
      const U = taggedUnion({
        switchOn: int32,
        arms: [{ tags: [0], key: 'v0' }],
      });
      expect(() => U.toXdr('unknown_key')).toThrow(
        XdrErrorCode.InvalidUnionDiscriminant,
      );
    });

    describe('multiple tags per arm', () => {
      const U = taggedUnion({
        switchOn: int32,
        arms: [
          { tags: [1, 2, 3], key: 'val', codec: xdrString(100) },
          { tags: [0], key: 'v0' },
        ],
      });

      it('all tags in the same arm work', () => {
        // Tags 1, 2, 3 all map to key 'val', so encoding { val: 'a' }
        // will use the first tag (1) from the reverse map.
        // But on decode, tags 1, 2, 3 all produce { val: ... }
        const encoded1 = U.toXdr({ val: 'a' });
        expect(U.fromXdr(encoded1)).toEqual({ val: 'a' });
      });
    });

    describe('is() helper', () => {
      it('returns true for matching key', () => {
        const val: string | Record<string, unknown> = { credit_alphanum4: {} };
        expect(is(val, 'credit_alphanum4')).toBe(true);
      });

      it('returns false for non-matching key', () => {
        const val: string | Record<string, unknown> = { credit_alphanum4: {} };
        expect(is(val, 'native')).toBe(false);
      });

      it('returns false for string values', () => {
        const val: string | Record<string, unknown> = 'native';
        expect(is(val, 'native')).toBe(false);
      });
    });

    describe('JSON roundtrip', () => {
      const AssetType = xdrEnum({
        native: 0,
        credit_alphanum4: 1,
      });

      interface AlphaNum4 {
        readonly asset_code: Uint8Array;
      }

      const AlphaNum4 = xdrStruct<AlphaNum4>([
        ['asset_code', varOpaque(4)],
      ]);

      const Asset = taggedUnion({
        switchOn: AssetType,
        arms: [
          { tags: ['native'] },
          { tags: ['credit_alphanum4'], codec: AlphaNum4 },
        ],
      });

      it('JSON roundtrips void arm', () => {
        const json = Asset.toJson('native');
        expect(Asset.fromJson(json)).toBe('native');
      });

      it('JSON roundtrips value arm', () => {
        const val = {
          credit_alphanum4: { asset_code: new Uint8Array([85, 83, 68, 67]) },
        };
        const json = Asset.toJson(val);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual({
          credit_alphanum4: { asset_code: '55534443' },
        });
        const restored = Asset.fromJson(json);
        expect((restored as any).credit_alphanum4.asset_code).toEqual(
          new Uint8Array([85, 83, 68, 67]),
        );
      });
    });
  });
});
