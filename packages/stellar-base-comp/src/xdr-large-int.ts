/**
 * XdrLargeInt — compat wrapper matching the official SDK's constructor signature:
 *   new XdrLargeInt(type, value)
 *
 * Accepts a single value (bigint/number/string) or an array of int32 parts.
 */

import { ScInt, type ScIntType } from '@stellar/contracts';
import { Hyper, UnsignedHyper } from './xdr-compat/hyper.js';
import { Int128, Uint128, Int256, Uint256 } from './large-int-classes.js';
import { ScVal as CompatScVal } from './generated/stellar_compat.js';

/** Combine 2 uint32 parts (low, high) into a uint64 bigint. */
function u32PairToU64(low: number | bigint, high: number | bigint): bigint {
  return (BigInt.asUintN(32, BigInt(high)) << 32n) | BigInt.asUintN(32, BigInt(low));
}

function arrayToBigInt(type: ScIntType, parts: (bigint | number)[]): bigint {
  switch (type) {
    case 'i64':
    case 'u64': {
      if (parts.length === 2) {
        const val = u32PairToU64(parts[0]!, parts[1]!);
        return type === 'i64' ? BigInt.asIntN(64, val) : val;
      }
      throw new Error(`Expected 2 parts for ${type}`);
    }
    case 'i128':
    case 'u128': {
      if (parts.length === 4) {
        const lo = u32PairToU64(parts[0]!, parts[1]!);
        const hi = u32PairToU64(parts[2]!, parts[3]!);
        const val = (hi << 64n) | lo;
        return type === 'i128' ? BigInt.asIntN(128, val) : BigInt.asUintN(128, val);
      }
      throw new Error(`Expected 4 parts for ${type}`);
    }
    case 'i256':
    case 'u256': {
      if (parts.length === 8) {
        const loLo = u32PairToU64(parts[0]!, parts[1]!);
        const loHi = u32PairToU64(parts[2]!, parts[3]!);
        const hiLo = u32PairToU64(parts[4]!, parts[5]!);
        const hiHi = u32PairToU64(parts[6]!, parts[7]!);
        const val = (hiHi << 192n) | (hiLo << 128n) | (loHi << 64n) | loLo;
        return type === 'i256' ? BigInt.asIntN(256, val) : BigInt.asUintN(256, val);
      }
      throw new Error(`Expected 8 parts for ${type}`);
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

export class XdrLargeInt {
  private readonly _inner: ScInt;
  readonly type: ScIntType;

  constructor(type: ScIntType, value: bigint | number | string | (bigint | number)[]) {
    this.type = type;
    if (Array.isArray(value)) {
      const bi = arrayToBigInt(type, value);
      this._inner = new ScInt(bi, { type });
    } else {
      this._inner = new ScInt(value, { type });
    }
  }

  toBigInt(): bigint {
    return this._inner.toBigInt();
  }

  toNumber(): number {
    return this._inner.toNumber();
  }

  toScVal() {
    return this._inner.toScVal();
  }

  toI64() {
    return this._inner.toI64();
  }

  toU64() {
    return this._inner.toU64();
  }

  toI128() {
    return this._inner.toI128();
  }

  toU128() {
    return this._inner.toU128();
  }

  toI256() {
    return this._inner.toI256();
  }

  toU256() {
    return this._inner.toU256();
  }

  toTimepoint(): any {
    return (CompatScVal as any)._fromModern({ Timepoint: this.toBigInt() });
  }

  toDuration(): any {
    return (CompatScVal as any)._fromModern({ Duration: this.toBigInt() });
  }

  toString(): string {
    return this.toBigInt().toString();
  }

  toJSON(): { value: string; type: string } {
    return { value: this.toBigInt().toString(), type: this.type };
  }

  get int(): any {
    const v = this.toBigInt();
    switch (this.type) {
      case 'i64': return new Hyper(v);
      case 'u64': return new UnsignedHyper(v);
      case 'i128': return new Int128(v);
      case 'u128': return new Uint128(v);
      case 'i256': return new Int256(v);
      case 'u256': return new Uint256(v);
      default: throw new Error(`Unknown type: ${this.type}`);
    }
  }

  /**
   * Maps an ScVal switch name (e.g., 'scvI64') to a type string (e.g., 'i64').
   * Matches js-stellar-base's XdrLargeInt.getType.
   */
  static getType(scvTypeName: string): ScIntType | 'timepoint' | 'duration' | undefined {
    const map: Record<string, ScIntType | 'timepoint' | 'duration'> = {
      scvI64: 'i64',
      scvU64: 'u64',
      scvI128: 'i128',
      scvU128: 'u128',
      scvI256: 'i256',
      scvU256: 'u256',
      scvTimepoint: 'timepoint',
      scvDuration: 'duration',
    };
    return map[scvTypeName];
  }
}
