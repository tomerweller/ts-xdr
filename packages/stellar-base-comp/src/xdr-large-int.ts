/**
 * XdrLargeInt — compat wrapper matching the official SDK's constructor signature:
 *   new XdrLargeInt(type, value)
 *
 * Delegates to ScInt internally.
 */

import { ScInt, type ScIntType } from '@stellar/contracts';

export class XdrLargeInt {
  private readonly _inner: ScInt;

  constructor(type: ScIntType, value: bigint | number | string) {
    this._inner = new ScInt(value, { type });
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
}
