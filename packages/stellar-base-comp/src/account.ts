/**
 * Account class compatible with js-stellar-base.
 * Stores address and sequence as strings.
 */

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
  private readonly _muxedAddress: string;
  private readonly _id: string;

  constructor(account: Account, id: string) {
    this._account = account;
    this._id = id;
    this._muxedAddress = account.accountId(); // simplified — real impl would compute M-address
  }

  static fromAddress(mAddress: string, sequenceNum: string): MuxedAccount {
    // For simplicity, extract the base G-address from the M-address
    // In a full implementation, this would decode the M-address to extract ed25519 key + id
    const account = new Account(mAddress, sequenceNum);
    return new MuxedAccount(account, '0');
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

  sequenceNumber(): string {
    return this._account.sequenceNumber();
  }

  incrementSequenceNumber(): void {
    this._account.incrementSequenceNumber();
  }
}
