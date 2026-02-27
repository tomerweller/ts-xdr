/**
 * Asset class compatible with js-stellar-base.
 */

import {
  nativeAsset,
  creditAsset,
  type Asset as ModernAsset,
} from '@stellar/tx-builder';
import {
  is,
  encodeStrkey,
  decodeStrkey,
  STRKEY_ED25519_PUBLIC,
} from '@stellar/xdr';
import {
  Asset as CompatAssetXdr,
  ChangeTrustAsset as CompatChangeTrustAsset,
} from './generated/stellar_compat.js';
import { getAssetContractId } from '@stellar/contracts';

export class Asset {
  private readonly _code: string;
  private readonly _issuer: string | null;

  constructor(code: string, issuer?: string | null) {
    if (code === 'XLM' && !issuer) {
      this._code = 'XLM';
      this._issuer = null;
    } else {
      if (!code || code.length > 12 || !/^[a-zA-Z0-9]+$/.test(code)) {
        throw new Error(
          `Asset code is invalid (maximum alphanumeric, 12 characters at max)`,
        );
      }
      this._code = code;
      this._issuer = issuer ?? null;
      if (!this._issuer && code !== 'XLM') {
        throw new Error('Issuer cannot be null');
      }
      if (this._issuer) {
        try {
          decodeStrkey(this._issuer);
        } catch {
          throw new Error('Issuer is invalid');
        }
      }
    }
  }

  static native(): Asset {
    return new Asset('XLM');
  }

  isNative(): boolean {
    return this._issuer === null;
  }

  get code(): string {
    return this._code;
  }

  get issuer(): string | undefined {
    return this._issuer ?? undefined;
  }

  getCode(): string {
    return this._code;
  }

  getIssuer(): string | undefined {
    return this._issuer ?? undefined;
  }

  getAssetType(): string {
    if (this.isNative()) return 'native';
    if (this._code.length <= 4) return 'credit_alphanum4';
    return 'credit_alphanum12';
  }

  _toModern(): ModernAsset {
    if (this.isNative()) {
      return nativeAsset();
    }
    return creditAsset(this._code, this._issuer!);
  }

  toXDRObject(): any {
    return (CompatAssetXdr as any)._fromModern(this._toModern());
  }

  toChangeTrustXDRObject(): any {
    return (CompatChangeTrustAsset as any)._fromModern(this._toModern());
  }

  static fromOperation(xdrAsset: any): Asset {
    const modern: ModernAsset = xdrAsset._toModern();
    return Asset._fromModern(modern);
  }

  static _fromModern(modern: ModernAsset): Asset {
    if (modern === 'Native' || typeof modern === 'string') {
      return Asset.native();
    }
    const decoder = new TextDecoder();
    if (is(modern, 'CreditAlphanum4')) {
      const code = decoder.decode(modern.CreditAlphanum4.assetCode).replace(/\0+$/, '');
      const issuer = extractIssuer(modern.CreditAlphanum4.issuer);
      return new Asset(code, issuer);
    }
    if (is(modern, 'CreditAlphanum12')) {
      const code = decoder.decode(modern.CreditAlphanum12.assetCode).replace(/\0+$/, '');
      const issuer = extractIssuer(modern.CreditAlphanum12.issuer);
      return new Asset(code, issuer);
    }
    throw new Error('Unknown asset type');
  }

  contractId(networkPassphrase: string): string {
    return getAssetContractId(this._toModern(), networkPassphrase);
  }

  toString(): string {
    if (this.isNative()) return 'native';
    return `${this._code}:${this._issuer}`;
  }

  equals(other: Asset): boolean {
    return this._code === other._code && this._issuer === other._issuer;
  }

  compare(other: Asset): number {
    return Asset.compare(this, other);
  }

  static compare(a: Asset, b: Asset): number {
    if (a.isNative() && b.isNative()) return 0;
    if (a.isNative()) return -1;
    if (b.isNative()) return 1;

    // Asset type ordering: credit_alphanum4 < credit_alphanum12
    const typeA = a.getAssetType();
    const typeB = b.getAssetType();
    if (typeA !== typeB) {
      return typeA === 'credit_alphanum4' ? -1 : 1;
    }

    // Code comparison: byte ordering (ASCII, not locale)
    const codeA = a._code;
    const codeB = b._code;
    if (codeA < codeB) return -1;
    if (codeA > codeB) return 1;

    // Issuer comparison
    const issA = a._issuer ?? '';
    const issB = b._issuer ?? '';
    if (issA < issB) return -1;
    if (issA > issB) return 1;
    return 0;
  }
}

function extractIssuer(accountId: any): string {
  if (is(accountId, 'PublicKeyTypeEd25519')) {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, accountId.PublicKeyTypeEd25519);
  }
  throw new Error('Unknown account ID type');
}
