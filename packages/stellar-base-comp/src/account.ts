/**
 * Account class compatible with js-stellar-base.
 * Stores address and sequence as strings.
 */

import {
  decodeStrkey,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_MUXED_ED25519,
} from '@stellar/strkey';
import { StrKey } from './strkey.js';

export class Account {
  private readonly _accountId: string;
  private _sequence: bigint;

  constructor(accountId: string, sequence: string) {
    if (!StrKey.isValidEd25519PublicKey(accountId)) {
      if (StrKey.isValidMed25519PublicKey(accountId)) {
        throw new Error(
          'accountId is a MuxedAccount (M-address); use MuxedAccount instead',
        );
      }
      throw new Error('accountId is invalid');
    }
    if (typeof sequence !== 'string') {
      throw new Error('sequence must be of type string');
    }
    this._accountId = accountId;
    this._sequence = BigInt(sequence);
  }

  accountId(): string {
    return this._accountId;
  }

  sequenceNumber(): string {
    return this._sequence.toString();
  }

  incrementSequenceNumber(): void {
    this._sequence += 1n;
  }

  /**
   * Internal: provides the AccountLike interface for the modern TransactionBuilder.
   */
  _toAccountLike(): { address: string; sequenceNumber: bigint } {
    return {
      address: this._accountId,
      sequenceNumber: this._sequence,
    };
  }

  /**
   * Internal: sync the sequence after the modern builder increments it.
   */
  _syncSequence(seq: bigint): void {
    this._sequence = seq;
  }
}

export class MuxedAccount {
  private readonly _account: Account;
  private _muxedAddress: string;
  private _id: string;

  constructor(account: Account, id: string) {
    this._account = account;
    this._id = id;
    // Compute the M-address from the base G-address and id
    const rawKey = decodeStrkey(account.accountId()).payload;
    const payload = new Uint8Array(40);
    payload.set(rawKey, 0);
    const view = new DataView(payload.buffer);
    view.setBigUint64(32, BigInt(id), false);
    this._muxedAddress = encodeStrkey(STRKEY_MUXED_ED25519, payload);
  }

  static fromAddress(mAddress: string, sequenceNum: string): MuxedAccount {
    const { version, payload } = decodeStrkey(mAddress);
    if (version !== STRKEY_MUXED_ED25519) {
      throw new Error('Expected M-address (muxed ed25519)');
    }
    const rawKey = payload.slice(0, 32);
    const view = new DataView(payload.buffer, payload.byteOffset + 32, 8);
    const id = view.getBigUint64(0, false);
    const gAddress = encodeStrkey(STRKEY_ED25519_PUBLIC, rawKey);
    const account = new Account(gAddress, sequenceNum);
    return new MuxedAccount(account, id.toString());
  }

  accountId(): string {
    return this._muxedAddress;
  }

  baseAccount(): Account {
    return this._account;
  }

  id(): string {
    return this._id;
  }

  setId(id: string): MuxedAccount {
    this._id = id;
    // Recompute M-address
    const rawKey = decodeStrkey(this._account.accountId()).payload;
    const payload = new Uint8Array(40);
    payload.set(rawKey, 0);
    const view = new DataView(payload.buffer);
    view.setBigUint64(32, BigInt(id), false);
    this._muxedAddress = encodeStrkey(STRKEY_MUXED_ED25519, payload);
    return this;
  }

  toXDRObject(): any {
    const rawKey = decodeStrkey(this._account.accountId()).payload;
    return {
      MuxedEd25519: {
        id: BigInt(this._id),
        ed25519: rawKey,
      },
    };
  }

  equals(other: MuxedAccount): boolean {
    return this._muxedAddress === other._muxedAddress;
  }

  sequenceNumber(): string {
    return this._account.sequenceNumber();
  }

  incrementSequenceNumber(): void {
    this._account.incrementSequenceNumber();
  }
}
