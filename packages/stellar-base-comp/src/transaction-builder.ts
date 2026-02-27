/**
 * TransactionBuilder compatible with js-stellar-base.
 * Sync build() via @noble/hashes/sha256.
 */

import {
  type Operation as ModernOperation,
  type Memo as ModernMemo,
  type Preconditions as ModernPreconditions,
  type TimeBounds as ModernTimeBounds,
  type Transaction as ModernTransaction,
  type TransactionEnvelope as ModernTransactionEnvelope,
  Transaction as TransactionCodec,
  TransactionEnvelope as TransactionEnvelopeCodec,
  encodeBase64,
  decodeBase64,
  is,
} from '@stellar/xdr';
import { parseMuxedAccount } from '@stellar/tx-builder';
import { hash, networkId } from './signing.js';
import { Account, type MuxedAccount } from './account.js';
import { Memo } from './memo.js';
import { Transaction, FeeBumpTransaction } from './transaction.js';

const ENVELOPE_TYPE_TX = new Uint8Array([0, 0, 0, 2]);
const ENVELOPE_TYPE_TX_FEE_BUMP = new Uint8Array([0, 0, 0, 5]);

export interface TransactionBuilderOpts {
  fee: string;
  networkPassphrase?: string;
  memo?: Memo;
  timebounds?: { minTime?: number | string | Date; maxTime?: number | string | Date };
  ledgerbounds?: { minLedger?: number; maxLedger?: number };
  minAccountSequence?: string;
  minAccountSequenceAge?: number;
  minAccountSequenceLedgerGap?: number;
  extraSigners?: string[];
  withMuxing?: boolean;
  sorobanData?: any;
}

export class TransactionBuilder {
  private readonly _source: Account | MuxedAccount;
  private readonly _fee: string;
  private _networkPassphrase: string;
  private _memo: Memo;
  private _operations: ModernOperation[] = [];
  private _timeBounds: { minTime: bigint; maxTime: bigint } | null;
  private _ledgerBounds: { minLedger: number; maxLedger: number } | null = null;
  private _minAccountSequence: bigint | null = null;
  private _minAccountSequenceAge: bigint | null = null;
  private _minAccountSequenceLedgerGap: number | null = null;
  private _extraSigners: string[] = [];
  private _sorobanData: any = null;
  private _timeout: number | null = null;

  constructor(source: Account | MuxedAccount, opts: TransactionBuilderOpts) {
    this._source = source;
    this._fee = opts.fee;
    this._networkPassphrase = opts.networkPassphrase ?? '';
    this._memo = opts.memo ?? Memo.none();

    if (opts.timebounds) {
      const toTimestamp = (v: string | number | Date | undefined): bigint => {
        if (v instanceof Date) return BigInt(Math.floor(v.getTime() / 1000));
        return BigInt(v ?? 0);
      };
      this._timeBounds = {
        minTime: toTimestamp(opts.timebounds.minTime),
        maxTime: toTimestamp(opts.timebounds.maxTime),
      };
    } else {
      this._timeBounds = null;
    }

    if (opts.ledgerbounds) {
      this._ledgerBounds = {
        minLedger: opts.ledgerbounds.minLedger ?? 0,
        maxLedger: opts.ledgerbounds.maxLedger ?? 0,
      };
    }

    if (opts.minAccountSequence) this._minAccountSequence = BigInt(opts.minAccountSequence);
    if (opts.minAccountSequenceAge != null) this._minAccountSequenceAge = BigInt(opts.minAccountSequenceAge);
    if (opts.minAccountSequenceLedgerGap != null) this._minAccountSequenceLedgerGap = opts.minAccountSequenceLedgerGap;
    if (opts.extraSigners) this._extraSigners = opts.extraSigners;
    if (opts.sorobanData) this._sorobanData = opts.sorobanData;
  }

  addOperation(op: any): this {
    // op is either a modern Operation or a compat Operation
    if (op._toModern) {
      this._operations.push(op._toModern());
    } else {
      this._operations.push(op);
    }
    return this;
  }

  addOperationAt(op: any, index: number): this {
    const modernOp = op._toModern ? op._toModern() : op;
    this._operations.splice(index, 0, modernOp);
    return this;
  }

  clearOperations(): this {
    this._operations = [];
    return this;
  }

  clearOperationAt(index: number): this {
    this._operations.splice(index, 1);
    return this;
  }

  addMemo(memo: Memo): this {
    this._memo = memo;
    return this;
  }

  setTimeout(seconds: number): this {
    if (seconds < 0) {
      throw new Error('Timeout must be >= 0');
    }
    if (seconds === 0) {
      // Infinite timeout
      this._timeBounds = { minTime: 0n, maxTime: 0n };
    } else {
      const maxTime = BigInt(Math.floor(Date.now() / 1000) + seconds);
      this._timeBounds = { minTime: 0n, maxTime };
    }
    return this;
  }

  setTimebounds(min: number | string, max: number | string): this {
    this._timeBounds = { minTime: BigInt(min), maxTime: BigInt(max) };
    return this;
  }

  setLedgerbounds(min: number, max: number): this {
    this._ledgerBounds = { minLedger: min, maxLedger: max };
    return this;
  }

  setMinAccountSequence(seq: string): this {
    this._minAccountSequence = BigInt(seq);
    return this;
  }

  setMinAccountSequenceAge(seconds: number): this {
    this._minAccountSequenceAge = BigInt(seconds);
    return this;
  }

  setMinAccountSequenceLedgerGap(gap: number): this {
    this._minAccountSequenceLedgerGap = gap;
    return this;
  }

  setExtraSigners(signers: string[]): this {
    this._extraSigners = signers;
    return this;
  }

  setNetworkPassphrase(passphrase: string): this {
    this._networkPassphrase = passphrase;
    return this;
  }

  setSorobanData(data: any): this {
    this._sorobanData = typeof data === 'string' ? data : data;
    return this;
  }

  hasV2Preconditions(): boolean {
    return !!(
      this._ledgerBounds ||
      this._minAccountSequence !== null ||
      this._minAccountSequenceAge !== null ||
      this._minAccountSequenceLedgerGap !== null ||
      this._extraSigners.length > 0
    );
  }

  /**
   * Synchronous build — computes transaction hash via @noble/hashes/sha256.
   */
  build(): Transaction {
    if (this._operations.length === 0) {
      throw new Error('Transaction must have at least one operation');
    }

    if (this._timeBounds === null) {
      throw new Error('TimeBounds has to be set or you must call setTimeout(TimeoutInfinite)');
    }

    // Increment sequence
    this._source.incrementSequenceNumber();

    const fee = parseInt(this._fee, 10) * this._operations.length;

    let cond: ModernPreconditions;
    if (this.hasV2Preconditions()) {
      cond = {
        V2: {
          timeBounds: this._timeBounds
            ? { minTime: this._timeBounds.minTime, maxTime: this._timeBounds.maxTime }
            : null,
          ledgerBounds: this._ledgerBounds ?? null,
          minSeqNum: this._minAccountSequence,
          minSeqAge: this._minAccountSequenceAge ?? 0n,
          minSeqLedgerGap: this._minAccountSequenceLedgerGap ?? 0,
          extraSigners: this._extraSigners as any,
        },
      };
    } else if (this._timeBounds) {
      cond = {
        Time: {
          minTime: this._timeBounds.minTime,
          maxTime: this._timeBounds.maxTime,
        },
      };
    } else {
      cond = 'None';
    }

    const sourceAddress = this._source instanceof Account
      ? (this._source as Account).accountId()
      : (this._source as MuxedAccount).accountId();

    const tx: ModernTransaction = {
      sourceAccount: parseMuxedAccount(sourceAddress),
      fee,
      seqNum: BigInt(this._source.sequenceNumber()),
      cond,
      memo: this._memo._toModern(),
      operations: this._operations,
      ext: '0',
    };

    // Compute hash synchronously
    const nid = networkId(this._networkPassphrase);
    const txBytes = TransactionCodec.toXdr(tx);
    const tagged = new Uint8Array(nid.length + ENVELOPE_TYPE_TX.length + txBytes.length);
    tagged.set(nid, 0);
    tagged.set(ENVELOPE_TYPE_TX, nid.length);
    tagged.set(txBytes, nid.length + ENVELOPE_TYPE_TX.length);
    const txHash = hash(tagged);

    // Create envelope → base64 → Transaction
    const envelope: ModernTransactionEnvelope = { Tx: { tx, signatures: [] } };
    const base64 = encodeBase64(TransactionEnvelopeCodec.toXdr(envelope));
    return new Transaction(base64, this._networkPassphrase);
  }

  /**
   * Clone a Transaction into a new TransactionBuilder for modification.
   */
  static cloneFrom(
    tx: Transaction,
    opts?: Partial<TransactionBuilderOpts>,
  ): TransactionBuilder {
    const account = new Account(tx.source, (BigInt(tx.sequence) - 1n).toString());
    const builder = new TransactionBuilder(account, {
      fee: (parseInt(tx.fee, 10) / (tx.operations.length || 1)).toString(),
      networkPassphrase: tx.networkPassphrase,
      ...(opts || {}),
    });
    if (tx.timeBounds) {
      builder.setTimebounds(tx.timeBounds.minTime, tx.timeBounds.maxTime);
    }
    builder.addMemo(tx.memo);
    for (const op of tx.operations) {
      builder.addOperation(op);
    }
    return builder;
  }

  /**
   * Parse an XDR envelope into a Transaction or FeeBumpTransaction.
   */
  static fromXDR(
    envelope: string | Uint8Array,
    networkPassphrase: string,
  ): Transaction | FeeBumpTransaction {
    const base64 = typeof envelope === 'string'
      ? envelope
      : encodeBase64(envelope);

    const envBytes = decodeBase64(base64);
    const env = TransactionEnvelopeCodec.fromXdr(envBytes);

    if (is(env, 'Tx')) {
      return new Transaction(base64, networkPassphrase);
    }
    if (is(env, 'TxFeeBump')) {
      return new FeeBumpTransaction(base64, networkPassphrase);
    }
    throw new Error('Unsupported envelope type');
  }

  /**
   * Build a fee bump transaction wrapping an inner transaction.
   */
  static buildFeeBumpTransaction(
    feeSource: string,
    baseFee: string,
    innerTx: Transaction,
    networkPassphrase: string,
  ): FeeBumpTransaction {
    const innerEnvelope = innerTx.toEnvelope();
    if (!is(innerEnvelope, 'Tx')) {
      throw new Error('Expected a TransactionV1 envelope');
    }

    const innerV1 = innerEnvelope.Tx;
    const innerOps = innerV1.tx.operations.length;
    const fee = BigInt(baseFee) * BigInt(innerOps + 1);

    const feeBumpTx = {
      feeSource: parseMuxedAccount(feeSource),
      fee,
      innerTx: { Tx: innerV1 },
      ext: '0' as const,
    };

    const fbEnvelope: ModernTransactionEnvelope = {
      TxFeeBump: { tx: feeBumpTx, signatures: [] },
    };

    const base64 = encodeBase64(TransactionEnvelopeCodec.toXdr(fbEnvelope));
    return new FeeBumpTransaction(base64, networkPassphrase);
  }
}
