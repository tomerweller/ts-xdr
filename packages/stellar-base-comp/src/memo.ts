/**
 * Memo class compatible with js-stellar-base.
 */

import {
  memoNone,
  memoText,
  memoId,
  memoHash,
  memoReturn,
  type Memo as ModernMemo,
} from '@stellar/tx-builder';
import { is } from '@stellar/xdr';
import { Memo as CompatMemoXdr } from './generated/stellar_compat.js';
import { UnsignedHyper } from './xdr-compat/hyper.js';

export type MemoType = 'none' | 'text' | 'id' | 'hash' | 'return';

export class Memo<T extends MemoType = MemoType> {
  readonly type: MemoType;
  readonly value: string | Uint8Array | null;

  private constructor(type: MemoType, value: string | Uint8Array | null) {
    this.type = type;
    this.value = value;
  }

  static none(): Memo {
    return new Memo('none', null);
  }

  static text(text: string): Memo {
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > 28) {
      throw new Error(`Memo text must be <= 28 bytes UTF-8, got ${bytes.length}`);
    }
    return new Memo('text', text);
  }

  static id(id: string): Memo {
    // Validate it's a valid uint64
    const bi = BigInt(id);
    if (bi < 0n || bi > 18446744073709551615n) {
      throw new Error('Memo ID must be a uint64');
    }
    return new Memo('id', id);
  }

  static hash(hash: Uint8Array | string): Memo {
    const bytes = typeof hash === 'string' ? hexToBytes(hash) : hash;
    if (bytes.length !== 32) {
      throw new Error('Memo hash must be exactly 32 bytes');
    }
    return new Memo('hash', bytes);
  }

  static return(hash: Uint8Array | string): Memo {
    const bytes = typeof hash === 'string' ? hexToBytes(hash) : hash;
    if (bytes.length !== 32) {
      throw new Error('Memo return hash must be exactly 32 bytes');
    }
    return new Memo('return', bytes);
  }

  _toModern(): ModernMemo {
    switch (this.type) {
      case 'none':
        return memoNone();
      case 'text':
        return memoText(this.value as string);
      case 'id':
        return memoId(BigInt(this.value as string));
      case 'hash':
        return memoHash(this.value as Uint8Array);
      case 'return':
        return memoReturn(this.value as Uint8Array);
    }
  }

  toXDRObject(): any {
    return (CompatMemoXdr as any)._fromModern(this._toModern());
  }

  static fromXDRObject(xdrMemo: any): Memo {
    const modern: ModernMemo = xdrMemo._toModern();
    return Memo._fromModern(modern);
  }

  static _fromModern(modern: ModernMemo): Memo {
    if (modern === 'None') return Memo.none();
    if (is(modern, 'Text')) return Memo.text(modern.Text);
    if (is(modern, 'Id')) return Memo.id(modern.Id.toString());
    if (is(modern, 'Hash')) return Memo.hash(modern.Hash);
    if (is(modern, 'Return')) return Memo.return(modern.Return);
    throw new Error('Unknown memo type');
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
