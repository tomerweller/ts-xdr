/**
 * SorobanRpc.Server — wraps RpcClient from @stellar/rpc-client,
 * providing the js-stellar-sdk Server API.
 */

import { RpcClient, type RpcClientOptions } from '@stellar/rpc-client';
import {
  type TransactionEnvelope,
  TransactionEnvelope as TransactionEnvelopeCodec,
  encodeBase64,
  decodeBase64,
  decodeStrkey,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
} from '@stellar/xdr';
import { Account } from '@stellar/stellar-base-comp';
import type {
  GetHealthResponse,
  GetNetworkResponse,
  GetLatestLedgerResponse,
  SimulateTransactionResponse,
  SendTransactionResponse,
  GetTransactionResponse,
  GetEventsResponse,
  GetLedgerEntriesResponse,
  GetVersionInfoResponse,
  GetFeeStatsResponse,
  GetTransactionsResponse,
  GetLedgersResponse,
} from './api.js';

export interface ServerOptions {
  allowHttp?: boolean;
  headers?: Record<string, string>;
}

export class Server {
  private readonly _client: RpcClient;

  constructor(url: string, opts?: ServerOptions) {
    this._client = new RpcClient(url, {
      allowHttp: opts?.allowHttp,
      headers: opts?.headers,
    });
  }

  async getHealth(): Promise<GetHealthResponse> {
    return this._client.getHealth() as any;
  }

  async getNetwork(): Promise<GetNetworkResponse> {
    return this._client.getNetwork() as any;
  }

  async getLatestLedger(): Promise<GetLatestLedgerResponse> {
    return this._client.getLatestLedger() as any;
  }

  async getAccount(address: string): Promise<Account> {
    const account = await this._client.getAccount(address);
    const seq = account.seqNum.toString();
    const result = new Account(address, seq);
    // Add id and sequence properties for compat (official SDK includes these)
    (result as any).id = address;
    (result as any).sequence = seq;
    return result;
  }

  async simulateTransaction(tx: any): Promise<SimulateTransactionResponse> {
    // tx might be a compat Transaction — extract the envelope
    let envelope: TransactionEnvelope;
    if (tx.toEnvelope) {
      envelope = tx.toEnvelope();
    } else {
      envelope = tx;
    }
    const result = await this._client.simulateTransaction(envelope) as any;
    // Official SDK adds `result` (singular) from `results[0]` for success responses
    if (result.results && result.results.length > 0 && !result.result) {
      result.result = result.results[0];
    }
    return result as any;
  }

  async prepareTransaction(tx: any): Promise<any> {
    let envelope: TransactionEnvelope;
    if (tx.toEnvelope) {
      envelope = tx.toEnvelope();
    } else {
      envelope = tx;
    }
    const prepared = await this._client.prepareTransaction(envelope);
    // Return as base64 string for the compat layer to parse
    return encodeBase64(TransactionEnvelopeCodec.toXdr(prepared));
  }

  async sendTransaction(tx: any): Promise<SendTransactionResponse> {
    let envelope: TransactionEnvelope;
    if (tx.toEnvelope) {
      envelope = tx.toEnvelope();
    } else {
      envelope = tx;
    }
    const result = await this._client.sendTransaction(envelope) as any;
    // Official SDK exposes `errorResult` alongside `errorResultXdr`
    if (result.errorResultXdr && !result.errorResult) {
      result.errorResult = result.errorResultXdr;
    }
    return result as any;
  }

  async getTransaction(hash: string): Promise<GetTransactionResponse> {
    const result = await this._client.getTransaction(hash);
    return result as any;
  }

  async getEvents(req: any): Promise<GetEventsResponse> {
    const result = await this._client.getEvents(req);
    return result as any;
  }

  async getLedgerEntries(...keys: any[]): Promise<GetLedgerEntriesResponse> {
    const result = await this._client.getLedgerEntries(keys.flat());
    return result as any;
  }

  async getVersionInfo(): Promise<GetVersionInfoResponse> {
    return this._client.getVersionInfo() as any;
  }

  async getFeeStats(): Promise<GetFeeStatsResponse> {
    return this._client.getFeeStats() as any;
  }

  async getTransactions(req: any): Promise<GetTransactionsResponse> {
    const result = await this._client.getTransactions(req);
    return result as any;
  }

  async getLedgers(req: any): Promise<GetLedgersResponse> {
    const result = await this._client.getLedgers(req);
    return result as any;
  }

  async getContractData(contractId: string, key: any, durability?: string): Promise<any> {
    const dur = durability === 'temporary' ? 'temporary' : 'persistent';
    const result = await this._client.getContractData(contractId, key, dur as any);
    return result;
  }

  async pollTransaction(hash: string, opts?: { attempts?: number; sleepStrategy?: (attempt: number) => number }): Promise<GetTransactionResponse> {
    const result = await this._client.pollTransaction(hash, opts);
    return result as any;
  }
}
