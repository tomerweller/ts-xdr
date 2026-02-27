/**
 * Contract Client — auto-generates typed methods from a Spec.
 * Matches @stellar/stellar-sdk contract.Client API.
 */

import { Spec } from '@stellar/contracts';
import { Operation, Account, TransactionBuilder, BASE_FEE } from '@stellar/stellar-base-comp';
import type { ClientOptions, MethodOptions } from './types.js';
import { DEFAULT_TIMEOUT, NULL_ACCOUNT } from './types.js';
import { AssembledTransaction } from './assembled-transaction.js';

export class Client {
  readonly spec: Spec;
  readonly options: ClientOptions;
  [key: string]: any;

  constructor(spec: Spec, options: ClientOptions) {
    this.spec = spec;
    this.options = options;
    this._generateMethods();
  }

  /**
   * Create a Client from a contract ID by fetching its spec from the network.
   */
  static async from(options: ClientOptions): Promise<Client> {
    if (!options.contractId) {
      throw new Error('contractId is required');
    }

    const { RpcClient } = await import('@stellar/rpc-client');
    const client = new RpcClient(options.rpcUrl, { allowHttp: options.allowHttp });

    // Fetch the contract's WASM to get the spec
    // For now, this is a simplified implementation
    throw new Error('Client.from() requires fetching contract spec from network — use Client constructor with a Spec instead');
  }

  /**
   * Create a Client from a WASM hash.
   */
  static async fromWasmHash(
    wasmHash: Uint8Array | string,
    options: ClientOptions,
    format?: 'hex' | 'base64',
  ): Promise<Client> {
    throw new Error('Client.fromWasmHash() requires fetching WASM from network — use Client constructor with a Spec instead');
  }

  /**
   * Create a Client from WASM bytecode.
   */
  static async fromWasm(
    wasm: Uint8Array,
    options: ClientOptions,
  ): Promise<Client> {
    const spec = new Spec(wasm as any);
    return new Client(spec, options);
  }

  /**
   * Deploy a new contract.
   */
  static async deploy<T = Client>(
    constructorArgs: Record<string, any> | null,
    options: MethodOptions & Omit<ClientOptions, 'contractId'> & {
      wasmHash: Uint8Array | string;
      salt?: Uint8Array;
      format?: 'hex' | 'base64';
      address?: string;
    },
  ): Promise<AssembledTransaction<T>> {
    const op = Operation.createCustomContract({
      address: options.address ?? options.publicKey ?? NULL_ACCOUNT,
      wasmHash: typeof options.wasmHash === 'string'
        ? hexToBytes(options.wasmHash)
        : options.wasmHash,
      constructorArgs: constructorArgs ? Object.values(constructorArgs) as any[] : [],
      salt: options.salt,
    });

    return AssembledTransaction.buildWithOp<T>(op, {
      method: '__constructor',
      networkPassphrase: options.networkPassphrase,
      rpcUrl: options.rpcUrl,
      publicKey: options.publicKey,
      signTransaction: options.signTransaction,
      signAuthEntry: options.signAuthEntry,
      fee: options.fee,
      timeoutInSeconds: options.timeoutInSeconds,
      allowHttp: options.allowHttp,
      headers: options.headers,
    });
  }

  /**
   * Reconstruct a transaction from JSON.
   */
  txFromJSON<T>(json: string): AssembledTransaction<T> {
    const data = JSON.parse(json);
    return AssembledTransaction.fromJSON<T>(
      {
        networkPassphrase: this.options.networkPassphrase,
        rpcUrl: this.options.rpcUrl,
        publicKey: this.options.publicKey,
        signTransaction: this.options.signTransaction,
        signAuthEntry: this.options.signAuthEntry,
        server: this.options.server,
        contractId: this.options.contractId,
      },
      data,
    );
  }

  /**
   * Reconstruct a transaction from XDR base64.
   */
  txFromXDR<T>(xdrBase64: string): AssembledTransaction<T> {
    return AssembledTransaction.fromXDR<T>(
      {
        networkPassphrase: this.options.networkPassphrase,
        rpcUrl: this.options.rpcUrl,
        publicKey: this.options.publicKey,
        signTransaction: this.options.signTransaction,
        signAuthEntry: this.options.signAuthEntry,
        server: this.options.server,
      },
      xdrBase64,
      this.spec,
    );
  }

  /**
   * Dynamically generate methods for each contract function.
   */
  private _generateMethods(): void {
    const funcs = this.spec.funcs();
    for (const func of funcs) {
      const name = func.name;
      if (!name || name === '__constructor') continue;

      // Create a method on this client that builds an AssembledTransaction
      this[name] = async (
        args?: Record<string, any>,
        methodOptions?: MethodOptions,
      ): Promise<AssembledTransaction<any>> => {
        // Pass args as-is — they should already be ScVal or will be handled by the operation
        const scArgs: any[] = args ? Object.values(args) : [];

        // Build the invokeContractFunction operation
        const op = Operation.invokeContractFunction({
          contract: this.options.contractId!,
          function: name,
          args: scArgs,
        });

        return AssembledTransaction.buildWithOp(op, {
          method: name,
          networkPassphrase: this.options.networkPassphrase,
          rpcUrl: this.options.rpcUrl,
          contractId: this.options.contractId,
          publicKey: methodOptions?.publicKey ?? this.options.publicKey,
          signTransaction: methodOptions?.signTransaction ?? this.options.signTransaction,
          signAuthEntry: methodOptions?.signAuthEntry ?? this.options.signAuthEntry,
          fee: methodOptions?.fee ?? undefined,
          timeoutInSeconds: methodOptions?.timeoutInSeconds,
          simulate: methodOptions?.simulate,
          restore: methodOptions?.restore,
          server: this.options.server,
          allowHttp: this.options.allowHttp,
          headers: this.options.headers,
          errorTypes: this.options.errorTypes,
          parseResultXdr: (xdr: any) => xdr,
        });
      };
    }
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
