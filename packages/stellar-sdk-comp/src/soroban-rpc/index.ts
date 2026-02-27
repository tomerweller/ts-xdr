export { Server } from './server.js';
export * as Api from './api.js';
export type * from './api.js';
export { Durability, parseRawSimulation, parseRawEvents } from './api.js';

// Wrap type guard functions to accept any SimulateTransactionResponse
import {
  isSimulationError as _isSimulationError,
  isSimulationSuccess as _isSimulationSuccess,
  isSimulationRestore as _isSimulationRestore,
} from '@stellar/rpc-client';
export function isSimulationError(sim: any): boolean { return _isSimulationError(sim); }
export function isSimulationSuccess(sim: any): boolean { return _isSimulationSuccess(sim); }
export function isSimulationRestore(sim: any): boolean { return _isSimulationRestore(sim); }

// Wrapped assembleTransaction: accepts compat Transaction, returns object with .build()
import { assembleTransaction as _assembleTransaction } from '@stellar/rpc-client';
import { Transaction as CompatTransaction } from '@stellar/stellar-base-comp';
import { TransactionEnvelope as TransactionEnvelopeCodec, encodeBase64 } from '@stellar/xdr';

export function assembleTransaction(tx: any, simulation: any): any {
  // Convert compat Transaction → modern TransactionEnvelope
  let envelope: any;
  if (tx && typeof tx.toEnvelope === 'function') {
    envelope = tx.toEnvelope();
  } else {
    envelope = tx;
  }

  const result = _assembleTransaction(envelope, simulation);

  // Wrap result in an object with .build() that returns a compat Transaction
  const networkPassphrase = tx.networkPassphrase || '';
  const base64 = encodeBase64(TransactionEnvelopeCodec.toXdr(result));
  return {
    build(): any {
      return new CompatTransaction(base64, networkPassphrase);
    },
    // Also provide toXDR() and toEnvelope() for direct use
    toXDR(): string {
      return base64;
    },
    toEnvelope(): any {
      return result;
    },
  };
}
