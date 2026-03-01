/**
 * Contract class compatible with js-stellar-base.
 */

import {
  decodeStrkey,
  encodeStrkey,
  STRKEY_CONTRACT,
} from '@stellar/xdr';
import {
  ScVal as CompatScVal,
  ScAddress as CompatScAddress,
  LedgerKey as CompatLedgerKey,
  Operation as CompatOperation,
} from './generated/stellar_compat.js';

export class Contract {
  private readonly _id: Uint8Array;

  constructor(contractId: string) {
    const { version, payload } = decodeStrkey(contractId);
    if (version !== STRKEY_CONTRACT) {
      throw new Error('Expected a contract address (C-address)');
    }
    this._id = payload;
  }

  contractId(): string {
    return encodeStrkey(STRKEY_CONTRACT, this._id);
  }

  address(): Address {
    // Lazy import to avoid circular
    return new Address(this.contractId());
  }

  call(method: string, ...args: any[]): any {
    // Build a full compat xdr.Operation with InvokeHostFunction body,
    // matching js-stellar-base's Contract.call() API.
    const modernOp = {
      sourceAccount: null,
      body: {
        InvokeHostFunction: {
          hostFunction: {
            InvokeContract: {
              contractAddress: { Contract: this._id },
              functionName: method,
              args: args.map((a: any) => typeof a?._toModern === 'function' ? a._toModern() : a),
            },
          },
          auth: [],
        },
      },
    };
    return (CompatOperation as any)._fromModern(modernOp);
  }

  toString(): string {
    return this.contractId();
  }

  getFootprint(): any {
    const modern = {
      ContractData: {
        contract: { Contract: this._id },
        key: 'LedgerKeyContractInstance',
        durability: 'Persistent',
      },
    };
    return (CompatLedgerKey as any)._fromModern(modern);
  }
}

// Import Address here to avoid circular dependency
import { Address } from './address.js';
