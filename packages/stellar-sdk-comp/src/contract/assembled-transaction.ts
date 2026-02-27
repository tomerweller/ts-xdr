/**
 * AssembledTransaction — wraps a Soroban contract invocation with
 * simulate/sign/send lifecycle management.
 * Matches @stellar/stellar-sdk AssembledTransaction API.
 */

import {
  TransactionBuilder,
  Transaction,
  Operation,
  Account,
  Networks,
  BASE_FEE,
  authorizeEntry,
} from '@stellar/stellar-base-comp';
import type { Spec } from '@stellar/contracts';
import type {
  ClientOptions,
  MethodOptions,
  SignTransaction,
  SignAuthEntry,
  XDR_BASE64,
} from './types.js';
import { DEFAULT_TIMEOUT, NULL_ACCOUNT } from './types.js';
import { SentTransaction } from './sent-transaction.js';

export interface AssembledTransactionOptions<T> extends MethodOptions {
  method?: string;
  args?: any[];
  parseResultXdr?: (xdr: any) => T;
  contractId?: string;
  networkPassphrase: string;
  rpcUrl: string;
  allowHttp?: boolean;
  headers?: Record<string, string>;
  errorTypes?: Record<string, any>;
  server?: any;
  publicKey?: string;
  signTransaction?: SignTransaction;
  signAuthEntry?: SignAuthEntry;
}

export abstract class Watcher {
  onSubmitted?(response?: any): void;
  onProgress?(response?: any): void;
}

export class AssembledTransaction<T> {
  public raw?: any;
  public built?: any;
  public simulation?: any;
  public signed?: any;
  public server: any;
  public options: AssembledTransactionOptions<T>;

  static Errors = {
    ExpiredState: class ExpiredStateError extends Error {
      constructor() { super('AssembledTransaction has expired'); this.name = 'ExpiredStateError'; }
    },
    NeedsMoreSignatures: class NeedsMoreSignaturesError extends Error {
      constructor() { super('Transaction requires more signatures'); this.name = 'NeedsMoreSignaturesError'; }
    },
    NoSignatureNeeded: class NoSignatureNeededError extends Error {
      constructor() { super('No signature needed for read-only call'); this.name = 'NoSignatureNeededError'; }
    },
    NoUnsignedNonInvokerAuthEntries: class NoUnsignedNonInvokerAuthEntriesError extends Error {
      constructor() { super('No unsigned non-invoker auth entries'); this.name = 'NoUnsignedNonInvokerAuthEntriesError'; }
    },
    FakeAccount: class FakeAccountError extends Error {
      constructor() { super('This account does not actually exist'); this.name = 'FakeAccountError'; }
    },
  };

  private constructor(options: AssembledTransactionOptions<T>) {
    this.options = options;
    this._initServer();
  }

  private _initServer(): void {
    if (this.options.server) {
      this.server = this.options.server;
    } else {
      // Lazy import to avoid circular deps — the Server class from soroban-rpc
      // For now, store the URL and create server on demand
      this.server = {
        _url: this.options.rpcUrl,
        async simulateTransaction(tx: any): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          const envelope = tx.toEnvelope ? tx.toEnvelope() : tx;
          return client.simulateTransaction(envelope) as any;
        },
        async sendTransaction(tx: any): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          const envelope = tx.toEnvelope ? tx.toEnvelope() : tx;
          return client.sendTransaction(envelope) as any;
        },
        async getTransaction(hash: string): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          return client.getTransaction(hash) as any;
        },
        async getAccount(address: string): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          const account = await client.getAccount(address);
          return new Account(address, account.seqNum.toString());
        },
        async getLatestLedger(): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          return client.getLatestLedger();
        },
        async prepareTransaction(tx: any): Promise<any> {
          const { RpcClient } = await import('@stellar/rpc-client');
          const client = new RpcClient(this._url);
          const envelope = tx.toEnvelope ? tx.toEnvelope() : tx;
          return client.prepareTransaction(envelope);
        },
      };
    }
  }

  /**
   * Build an AssembledTransaction from method name and args.
   */
  static async build<T>(
    options: AssembledTransactionOptions<T>,
  ): Promise<AssembledTransaction<T>> {
    const tx = new AssembledTransaction<T>(options);
    await tx._build();
    await tx.simulate();
    return tx;
  }

  /**
   * Build with a pre-constructed operation.
   */
  static async buildWithOp<T>(
    operation: any,
    options: AssembledTransactionOptions<T>,
  ): Promise<AssembledTransaction<T>> {
    const tx = new AssembledTransaction<T>(options);
    tx.raw = operation;
    await tx.simulate();
    return tx;
  }

  /**
   * Reconstruct from JSON (previously serialized).
   */
  static fromJSON<T>(
    options: Omit<AssembledTransactionOptions<T>, 'args'>,
    data: { tx: XDR_BASE64; simulationResult?: any; simulationTransactionData?: XDR_BASE64 },
  ): AssembledTransaction<T> {
    const tx = new AssembledTransaction<T>(options as AssembledTransactionOptions<T>);
    tx.built = new Transaction(data.tx, options.networkPassphrase);
    if (data.simulationResult) {
      tx.simulation = data.simulationResult;
    }
    return tx;
  }

  /**
   * Reconstruct from XDR base64.
   */
  static fromXDR<T>(
    options: Omit<AssembledTransactionOptions<T>, 'args' | 'method' | 'parseResultXdr'>,
    encodedXDR: string,
    spec?: Spec,
  ): AssembledTransaction<T> {
    const tx = new AssembledTransaction<T>(options as AssembledTransactionOptions<T>);
    tx.built = new Transaction(encodedXDR, options.networkPassphrase);
    return tx;
  }

  private async _build(): Promise<void> {
    const publicKey = this.options.publicKey || NULL_ACCOUNT;
    let account: any;
    if (publicKey === NULL_ACCOUNT) {
      account = new Account(NULL_ACCOUNT, '0');
    } else {
      try {
        account = await this.server.getAccount(publicKey);
      } catch {
        account = new Account(publicKey, '0');
      }
    }

    const timeout = this.options.timeoutInSeconds ?? DEFAULT_TIMEOUT;
    const fee = this.options.fee ?? BASE_FEE;

    const builder = new TransactionBuilder(account, {
      fee,
      networkPassphrase: this.options.networkPassphrase,
    });

    if (this.raw) {
      builder.addOperation(this.raw);
    }

    builder.setTimeout(timeout);
    this.built = builder.build();
  }

  /**
   * Serialize to JSON string.
   */
  toJSON(): string {
    if (!this.built) throw new Error('Transaction has not been built yet');
    return JSON.stringify({
      tx: this.built.toXDR(),
      simulation: this.simulation,
    });
  }

  /**
   * Serialize to XDR base64.
   */
  toXDR(): string {
    if (!this.built) throw new Error('Transaction has not been built yet');
    return this.built.toXDR();
  }

  /**
   * Simulate the transaction against the RPC.
   */
  async simulate(options?: { restore?: boolean }): Promise<this> {
    if (!this.built) throw new Error('Transaction has not been built yet');
    this.simulation = await this.server.simulateTransaction(this.built);

    // If simulation has transactionData, rebuild the transaction with it
    if (this.simulation && !this.simulation.error) {
      try {
        const prepared = await this.server.prepareTransaction(this.built);
        if (prepared) {
          // prepared is a TransactionEnvelope - convert to base64 and re-parse
          const { TransactionEnvelope: TxEnvCodec, encodeBase64 } = await import('@stellar/xdr');
          const base64 = encodeBase64(TxEnvCodec.toXdr(prepared));
          this.built = new Transaction(base64, this.options.networkPassphrase);
        }
      } catch {
        // Preparation may fail for read-only calls — that's OK
      }
    }
    return this;
  }

  /**
   * Sign the transaction using the configured signer.
   */
  async sign(options?: {
    force?: boolean;
    signTransaction?: SignTransaction;
  }): Promise<void> {
    if (!this.built) throw new Error('Transaction has not been built yet');

    const signer = options?.signTransaction ?? this.options.signTransaction;
    if (!signer) throw new Error('No signTransaction function provided');

    const xdr = this.built.toXDR();
    const result = await signer(xdr, {
      networkPassphrase: this.options.networkPassphrase,
      address: this.options.publicKey,
    });

    this.signed = new Transaction(result.tx, this.options.networkPassphrase);
    this.built = this.signed;
  }

  /**
   * Send the signed transaction to the network.
   */
  async send(watcher?: Watcher): Promise<SentTransaction<T>> {
    return SentTransaction.init(this, watcher);
  }

  /**
   * Sign and send in one step.
   */
  async signAndSend(options?: {
    force?: boolean;
    signTransaction?: SignTransaction;
    watcher?: Watcher;
  }): Promise<SentTransaction<T>> {
    await this.sign({
      force: options?.force,
      signTransaction: options?.signTransaction,
    });
    return this.send(options?.watcher);
  }

  /**
   * Find addresses that need to sign auth entries (non-invoker).
   */
  needsNonInvokerSigningBy(options?: {
    includeAlreadySigned?: boolean;
  }): string[] {
    // For now return empty array — full implementation would inspect auth entries
    return [];
  }

  /**
   * Sign authorization entries for non-invoker signers.
   */
  async signAuthEntries(options?: {
    expiration?: number | Promise<number>;
    address?: string;
    signAuthEntry?: SignAuthEntry;
    authorizeEntry?: typeof authorizeEntry;
  }): Promise<void> {
    // Stub — would iterate auth entries and sign each
  }

  /**
   * Restore footprint if simulation indicates it needs restoration.
   */
  async restoreFootprint(
    restorePreamble: { minResourceFee: string; transactionData: any },
    account?: any,
  ): Promise<any> {
    // Stub — would build and submit a restore footprint transaction
    throw new Error('restoreFootprint not yet fully implemented');
  }

  /**
   * Get simulation data.
   */
  get simulationData(): {
    result: any;
    transactionData: any;
  } {
    if (!this.simulation) throw new Error('Transaction has not been simulated');
    const result = this.simulation.results?.[0] ?? this.simulation.result;
    return {
      result,
      transactionData: this.simulation.transactionData,
    };
  }

  /**
   * Get the parsed result from simulation.
   */
  get result(): T {
    const { result } = this.simulationData;
    if (this.options.parseResultXdr && result?.retval) {
      return this.options.parseResultXdr(result.retval);
    }
    return result?.retval as T;
  }

  /**
   * Check if this is a read-only call (no state changes).
   */
  get isReadCall(): boolean {
    if (!this.simulation) return false;
    // A read call typically has no auth entries and no state changes
    const result = this.simulation.results?.[0] ?? this.simulation.result;
    return result && (!result.auth || result.auth.length === 0);
  }
}
