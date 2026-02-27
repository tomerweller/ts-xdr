/**
 * Transaction / FeeBumpTransaction classes compatible with js-stellar-base.
 */

import {
  TransactionEnvelope as TransactionEnvelopeCodec,
  Transaction as TransactionCodec,
  FeeBumpTransaction as FeeBumpTransactionCodec,
  type TransactionEnvelope as ModernTransactionEnvelope,
  type TransactionV1Envelope as ModernTransactionV1Envelope,
  type Transaction as ModernTransaction,
  type FeeBumpTransaction as ModernFeeBumpTransaction,
  type FeeBumpTransactionEnvelope as ModernFeeBumpTransactionEnvelope,
  type DecoratedSignature as ModernDecoratedSignature,
  is,
  encodeBase64,
  decodeBase64,
  encodeStrkey,
  decodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_MUXED_ED25519,
} from '@stellar/xdr';
import { hash, networkId } from './signing.js';
import { Memo } from './memo.js';
import { Operation } from './operation.js';
import type { Keypair } from './keypair.js';

const ENVELOPE_TYPE_TX = new Uint8Array([0, 0, 0, 2]);
const ENVELOPE_TYPE_TX_FEE_BUMP = new Uint8Array([0, 0, 0, 5]);

function computeTransactionHash(tx: ModernTransaction, passphrase: string): Uint8Array {
  const nid = networkId(passphrase);
  const txBytes = TransactionCodec.toXdr(tx);
  const tagged = new Uint8Array(nid.length + ENVELOPE_TYPE_TX.length + txBytes.length);
  tagged.set(nid, 0);
  tagged.set(ENVELOPE_TYPE_TX, nid.length);
  tagged.set(txBytes, nid.length + ENVELOPE_TYPE_TX.length);
  return hash(tagged);
}

function computeFeeBumpHash(tx: ModernFeeBumpTransaction, passphrase: string): Uint8Array {
  const nid = networkId(passphrase);
  const txBytes = FeeBumpTransactionCodec.toXdr(tx);
  const tagged = new Uint8Array(nid.length + ENVELOPE_TYPE_TX_FEE_BUMP.length + txBytes.length);
  tagged.set(nid, 0);
  tagged.set(ENVELOPE_TYPE_TX_FEE_BUMP, nid.length);
  tagged.set(txBytes, nid.length + ENVELOPE_TYPE_TX_FEE_BUMP.length);
  return hash(tagged);
}

function muxedAccountToAddress(muxed: any): string {
  if (is(muxed, 'Ed25519')) {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, muxed.Ed25519);
  }
  if (is(muxed, 'MuxedEd25519')) {
    const payload = new Uint8Array(40);
    payload.set(muxed.MuxedEd25519.ed25519, 0);
    const view = new DataView(payload.buffer);
    view.setBigUint64(32, muxed.MuxedEd25519.id, false);
    return encodeStrkey(STRKEY_MUXED_ED25519, payload);
  }
  throw new Error('Unknown muxed account type');
}

export class Transaction<TMemo extends Memo = Memo, TOps extends any[] = any[]> {
  readonly source: string;
  readonly fee: string;
  readonly sequence: string;
  readonly memo: Memo;
  readonly operations: any[];
  readonly timeBounds: { minTime: string; maxTime: string } | null;
  readonly networkPassphrase: string;

  private readonly _tx: ModernTransaction;
  private readonly _hash: Uint8Array;
  private _signatures: ModernDecoratedSignature[];

  constructor(envelope: string, networkPassphrase: string) {
    this.networkPassphrase = networkPassphrase;
    const envBytes = decodeBase64(envelope);
    const env = TransactionEnvelopeCodec.fromXdr(envBytes);

    if (!is(env, 'Tx')) {
      throw new Error('Expected a TransactionV1 envelope');
    }

    const v1 = env.Tx;
    this._tx = v1.tx;
    this._signatures = [...v1.signatures];
    this._hash = computeTransactionHash(this._tx, networkPassphrase);

    this.source = muxedAccountToAddress(this._tx.sourceAccount);
    this.fee = this._tx.fee.toString();
    this.sequence = this._tx.seqNum.toString();
    this.memo = Memo._fromModern(this._tx.memo);
    this.operations = this._tx.operations.map(op => Operation.fromXDRObject(op));

    if (is(this._tx.cond, 'Time')) {
      this.timeBounds = {
        minTime: this._tx.cond.Time.minTime.toString(),
        maxTime: this._tx.cond.Time.maxTime.toString(),
      };
    } else if (is(this._tx.cond, 'V2') && this._tx.cond.V2.timeBounds) {
      this.timeBounds = {
        minTime: this._tx.cond.V2.timeBounds.minTime.toString(),
        maxTime: this._tx.cond.V2.timeBounds.maxTime.toString(),
      };
    } else {
      this.timeBounds = null;
    }
  }

  /** Construct from already-parsed transaction */
  static _fromParsed(
    tx: ModernTransaction,
    signatures: ModernDecoratedSignature[],
    networkPassphrase: string,
  ): Transaction {
    // Use a roundtrip via envelope base64
    const envelope: ModernTransactionEnvelope = {
      Tx: { tx, signatures },
    };
    const base64 = encodeBase64(TransactionEnvelopeCodec.toXdr(envelope));
    return new Transaction(base64, networkPassphrase);
  }

  sign(...keypairs: Keypair[]): void {
    for (const kp of keypairs) {
      this._signatures.push(kp.signDecorated(this._hash));
    }
  }

  hash(): Uint8Array {
    return this._hash;
  }

  signatureBase(): Uint8Array {
    const nid = networkId(this.networkPassphrase);
    const txBytes = TransactionCodec.toXdr(this._tx);
    const tagged = new Uint8Array(nid.length + ENVELOPE_TYPE_TX.length + txBytes.length);
    tagged.set(nid, 0);
    tagged.set(ENVELOPE_TYPE_TX, nid.length);
    tagged.set(txBytes, nid.length + ENVELOPE_TYPE_TX.length);
    return tagged;
  }

  get signatures(): ModernDecoratedSignature[] {
    return this._signatures;
  }

  addSignature(publicKey: string, signature: string): void {
    const sigBytes = decodeBase64(signature);
    const { payload } = decodeStrkey(publicKey);
    const hint = payload.slice(-4);
    this._signatures.push({ hint, signature: sigBytes });
  }

  toEnvelope(): ModernTransactionEnvelope {
    return { Tx: { tx: this._tx, signatures: this._signatures } };
  }

  toXDR(): string {
    return encodeBase64(TransactionEnvelopeCodec.toXdr(this.toEnvelope()));
  }

  /** Internal: get the modern Transaction struct */
  _getModernTx(): ModernTransaction {
    return this._tx;
  }
}

export class FeeBumpTransaction {
  readonly feeSource: string;
  readonly fee: string;
  readonly innerTransaction: Transaction;
  readonly networkPassphrase: string;

  private readonly _tx: ModernFeeBumpTransaction;
  private readonly _hash: Uint8Array;
  private _signatures: ModernDecoratedSignature[];

  constructor(envelope: string, networkPassphrase: string) {
    this.networkPassphrase = networkPassphrase;
    const envBytes = decodeBase64(envelope);
    const env = TransactionEnvelopeCodec.fromXdr(envBytes);

    if (!is(env, 'TxFeeBump')) {
      throw new Error('Expected a FeeBumpTransaction envelope');
    }

    const bump = env.TxFeeBump;
    this._tx = bump.tx;
    this._signatures = [...bump.signatures];
    this._hash = computeFeeBumpHash(this._tx, networkPassphrase);

    this.feeSource = muxedAccountToAddress(this._tx.feeSource);
    this.fee = this._tx.fee.toString();

    // Extract inner transaction
    const innerEnv = this._tx.innerTx;
    if (!is(innerEnv, 'Tx')) {
      throw new Error('Unsupported inner transaction type');
    }
    const innerV1 = innerEnv.Tx;
    this.innerTransaction = Transaction._fromParsed(
      innerV1.tx,
      [...innerV1.signatures],
      networkPassphrase,
    );
  }

  get operations(): any[] {
    return this.innerTransaction.operations;
  }

  sign(...keypairs: Keypair[]): void {
    for (const kp of keypairs) {
      this._signatures.push(kp.signDecorated(this._hash));
    }
  }

  hash(): Uint8Array {
    return this._hash;
  }

  signatureBase(): Uint8Array {
    const nid = networkId(this.networkPassphrase);
    const txBytes = FeeBumpTransactionCodec.toXdr(this._tx);
    const tagged = new Uint8Array(nid.length + ENVELOPE_TYPE_TX_FEE_BUMP.length + txBytes.length);
    tagged.set(nid, 0);
    tagged.set(ENVELOPE_TYPE_TX_FEE_BUMP, nid.length);
    tagged.set(txBytes, nid.length + ENVELOPE_TYPE_TX_FEE_BUMP.length);
    return tagged;
  }

  get signatures(): ModernDecoratedSignature[] {
    return this._signatures;
  }

  toEnvelope(): ModernTransactionEnvelope {
    return { TxFeeBump: { tx: this._tx, signatures: this._signatures } };
  }

  toXDR(): string {
    return encodeBase64(TransactionEnvelopeCodec.toXdr(this.toEnvelope()));
  }
}
