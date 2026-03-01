/**
 * ScInt compat wrapper — matches js-stellar-base's ScInt API.
 *
 * Adds .type auto-detection, .valueOf(), .toString(), .toJSON(),
 * .toTimepoint(), .toDuration(), and wraps toI64/toU64/etc returns
 * in compat xdr.ScVal objects.
 */

import { ScInt as ModernScInt, type ScIntType } from '@stellar/contracts';
import { ScVal as CompatScVal } from './generated/stellar_compat.js';
import { Int128, Uint128, Int256, Uint256 } from './large-int-classes.js';
import { XdrLargeInt } from './xdr-large-int.js';

const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;
const U256_MAX = (1n << 256n) - 1n;
const I64_MIN = -(1n << 63n);

function autoDetectType(v: bigint): ScIntType {
  if (v >= 0n) {
    if (v <= U64_MAX) return 'u64';
    if (v <= U128_MAX) return 'u128';
    if (v <= U256_MAX) return 'u256';
    throw new RangeError(`Expected value in range for u256, got ${v}`);
  } else {
    if (v >= I64_MIN) return 'i64';
    if (v >= -(1n << 127n)) return 'i128';
    if (v >= -(1n << 255n)) return 'i256';
    throw new RangeError(`Expected value in range for i256, got ${v}`);
  }
}

function wrapScVal(modern: any): any {
  return (CompatScVal as any)._fromModern(modern);
}

// Maps extended type names (timepoint, duration) to their underlying ScInt type
const EXTENDED_TYPE_MAP: Record<string, ScIntType> = {
  timepoint: 'u64',
  duration: 'u64',
};

export type ExtendedScIntType = ScIntType | 'timepoint' | 'duration';

export class ScInt {
  private readonly _inner: ModernScInt;
  readonly type: ExtendedScIntType;

  constructor(value: number | bigint | string, opts?: { type?: ExtendedScIntType }) {
    const bi = BigInt(value);
    if (opts?.type) {
      // Check if unsigned type gets negative value
      const underlyingType = EXTENDED_TYPE_MAP[opts.type] ?? opts.type;
      if ((underlyingType === 'u64' || underlyingType === 'u128' || underlyingType === 'u256') && bi < 0n) {
        throw new RangeError(`Value ${bi} is negative, but type is ${opts.type}`);
      }
      this.type = opts.type;
    } else {
      this.type = autoDetectType(bi);
    }
    // Use the underlying numeric type for ModernScInt (it doesn't support timepoint/duration)
    const modernType = (EXTENDED_TYPE_MAP[this.type] ?? this.type) as ScIntType;
    this._inner = new ModernScInt(value, { type: modernType });
  }

  get int(): XdrLargeInt {
    const xlType = (EXTENDED_TYPE_MAP[this.type] ?? this.type) as ScIntType;
    return new XdrLargeInt(xlType, this.toBigInt());
  }

  toBigInt(): bigint {
    return this._inner.toBigInt();
  }

  toNumber(): number {
    const v = this._inner.toBigInt();
    if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(-Number.MAX_SAFE_INTEGER)) {
      throw new RangeError(`Value ${v} is not in range for a Number`);
    }
    return Number(v);
  }

  toString(): string {
    return this._inner.toBigInt().toString();
  }

  valueOf(): any {
    const v = this._inner.toBigInt();
    switch (this.type) {
      case 'i128': return new Int128(v);
      case 'u128': return new Uint128(v);
      case 'i256': return new Int256(v);
      case 'u256': return new Uint256(v);
      default: {
        const xlType = (EXTENDED_TYPE_MAP[this.type] ?? this.type) as ScIntType;
        return new XdrLargeInt(xlType, v);
      }
    }
  }

  toJSON(): { value: string; type: ExtendedScIntType } {
    return { value: this._inner.toBigInt().toString(), type: this.type };
  }

  toI64(): any {
    this._assertFits('i64');
    return wrapScVal({ I64: this._inner.toBigInt() });
  }

  toU64(): any {
    this._assertFits('u64');
    // Allow negative values by taking unsigned 64-bit representation
    return wrapScVal({ U64: BigInt.asUintN(64, this._inner.toBigInt()) });
  }

  toI128(): any {
    this._assertFits('i128');
    const v = this._inner.toBigInt();
    return wrapScVal({ I128: { hi: v >> 64n, lo: BigInt.asUintN(64, v) } });
  }

  toU128(): any {
    this._assertFits('u128');
    const v = BigInt.asUintN(128, this._inner.toBigInt());
    return wrapScVal({ U128: { hi: (v >> 64n) & U64_MAX, lo: v & U64_MAX } });
  }

  toI256(): any {
    const v = this._inner.toBigInt();
    return wrapScVal({
      I256: {
        hiHi: v >> 192n,
        hiLo: BigInt.asUintN(64, v >> 128n),
        loHi: BigInt.asUintN(64, v >> 64n),
        loLo: BigInt.asUintN(64, v),
      },
    });
  }

  toU256(): any {
    const v = BigInt.asUintN(256, this._inner.toBigInt());
    return wrapScVal({
      U256: {
        hiHi: (v >> 192n) & U64_MAX,
        hiLo: (v >> 128n) & U64_MAX,
        loHi: (v >> 64n) & U64_MAX,
        loLo: v & U64_MAX,
      },
    });
  }

  toTimepoint(): any {
    this._assertFits('u64');
    return wrapScVal({ Timepoint: this._inner.toBigInt() });
  }

  toDuration(): any {
    this._assertFits('u64');
    return wrapScVal({ Duration: this._inner.toBigInt() });
  }

  toScVal(): any {
    // Handle extended types that ModernScInt doesn't know about
    if (this.type === 'timepoint') return this.toTimepoint();
    if (this.type === 'duration') return this.toDuration();
    return wrapScVal(this._inner.toScVal());
  }

  private _assertFits(target: ScIntType): void {
    const bits: Record<string, number> = {
      i64: 64, u64: 64, i128: 128, u128: 128, i256: 256, u256: 256,
      timepoint: 64, duration: 64,
    };
    const typeBits = bits[this.type] ?? 64;
    const targetBits = bits[target] ?? 64;
    if (typeBits > targetBits) {
      throw new RangeError(`Value type ${this.type} is too large for ${target}`);
    }
  }
}
