/**
 * Horizon.Server — wraps HorizonClient from @stellar/horizon-client,
 * providing the js-stellar-sdk Horizon.Server API with call builders.
 */

import {
  HorizonClient,
  type HorizonClientOptions,
} from '@stellar/horizon-client';
import {
  type TransactionEnvelope,
  TransactionEnvelope as TransactionEnvelopeCodec,
} from '@stellar/xdr';
import type { Asset } from '@stellar/stellar-base-comp';
import { Transaction, FeeBumpTransaction } from '@stellar/stellar-base-comp';
import {
  checkMemoRequired,
  AccountRequiresMemoError,
} from '@stellar/seps';
import { AccountResponse } from './api.js';
import type {
  RootResponse,
  FeeStatsResponse,
  SubmitTransactionResponse,
  SubmitAsyncTransactionResponse,
} from './api.js';
import {
  AccountCallBuilder,
  LedgerCallBuilder,
  TransactionCallBuilder,
  OperationCallBuilder,
  PaymentCallBuilder,
  EffectCallBuilder,
  OfferCallBuilder,
  TradesCallBuilder,
  AssetsCallBuilder,
  ClaimableBalanceCallBuilder,
  LiquidityPoolCallBuilder,
  OrderbookCallBuilder,
  StrictReceivePathCallBuilder,
  StrictSendPathCallBuilder,
  TradeAggregationCallBuilder,
  FriendbotBuilder,
} from './call-builder.js';

export interface ServerOptions extends HorizonClientOptions {}

export class Server {
  readonly serverURL: string;
  private readonly _client: HorizonClient;
  private readonly _headers: Record<string, string>;

  constructor(url: string, opts?: ServerOptions) {
    this._client = new HorizonClient(url, opts);
    this.serverURL = this._client.url;
    this._headers = opts?.headers ?? {};
  }

  // -----------------------------------------------------------------------
  // Call builders
  // -----------------------------------------------------------------------

  accounts(): AccountCallBuilder {
    return new AccountCallBuilder(this.serverURL, this._headers);
  }

  ledgers(): LedgerCallBuilder {
    return new LedgerCallBuilder(this.serverURL, this._headers);
  }

  transactions(): TransactionCallBuilder {
    return new TransactionCallBuilder(this.serverURL, this._headers);
  }

  operations(): OperationCallBuilder {
    return new OperationCallBuilder(this.serverURL, this._headers);
  }

  payments(): PaymentCallBuilder {
    return new PaymentCallBuilder(this.serverURL, this._headers);
  }

  effects(): EffectCallBuilder {
    return new EffectCallBuilder(this.serverURL, this._headers);
  }

  offers(): OfferCallBuilder {
    return new OfferCallBuilder(this.serverURL, this._headers);
  }

  trades(): TradesCallBuilder {
    return new TradesCallBuilder(this.serverURL, this._headers);
  }

  assets(): AssetsCallBuilder {
    return new AssetsCallBuilder(this.serverURL, this._headers);
  }

  claimableBalances(): ClaimableBalanceCallBuilder {
    return new ClaimableBalanceCallBuilder(this.serverURL, this._headers);
  }

  liquidityPools(): LiquidityPoolCallBuilder {
    return new LiquidityPoolCallBuilder(this.serverURL, this._headers);
  }

  orderbook(selling: Asset, buying: Asset): OrderbookCallBuilder {
    return new OrderbookCallBuilder(this.serverURL, this._headers, selling, buying);
  }

  strictReceivePaths(
    source: string | Asset[],
    destinationAsset: Asset,
    destinationAmount: string,
  ): StrictReceivePathCallBuilder {
    return new StrictReceivePathCallBuilder(
      this.serverURL,
      this._headers,
      source,
      destinationAsset,
      destinationAmount,
    );
  }

  strictSendPaths(
    sourceAsset: Asset,
    sourceAmount: string,
    destination: string | Asset[],
  ): StrictSendPathCallBuilder {
    return new StrictSendPathCallBuilder(
      this.serverURL,
      this._headers,
      sourceAsset,
      sourceAmount,
      destination,
    );
  }

  tradeAggregation(
    base: Asset,
    counter: Asset,
    startTime: number,
    endTime: number,
    resolution: number,
    offset?: number,
  ): TradeAggregationCallBuilder {
    return new TradeAggregationCallBuilder(
      this.serverURL,
      this._headers,
      base,
      counter,
      startTime,
      endTime,
      resolution,
      offset,
    );
  }

  // -----------------------------------------------------------------------
  // Direct methods
  // -----------------------------------------------------------------------

  async root(): Promise<RootResponse> {
    return this._client.root();
  }

  async feeStats(): Promise<FeeStatsResponse> {
    return this._client.feeStats();
  }

  async fetchBaseFee(): Promise<number> {
    return this._client.fetchBaseFee();
  }

  async loadAccount(accountId: string): Promise<AccountResponse> {
    const record = await this._client.getAccount(accountId);
    return new AccountResponse(record);
  }

  async submitTransaction(tx: any): Promise<SubmitTransactionResponse> {
    const envelope = this._extractEnvelope(tx);
    return this._client.submitTransaction(envelope);
  }

  async submitAsyncTransaction(tx: any): Promise<SubmitAsyncTransactionResponse> {
    const envelope = this._extractEnvelope(tx);
    return this._client.submitAsyncTransaction(envelope);
  }

  async checkMemoRequired(
    transaction: Transaction | FeeBumpTransaction,
  ): Promise<void> {
    const inner =
      transaction instanceof FeeBumpTransaction
        ? transaction.innerTransaction
        : transaction;
    const memoType = inner.memo.type;
    const operations = inner.operations.map((op: any) => ({
      type: op.type ?? '',
      destination: 'destination' in op ? (op.destination as string) : undefined,
    }));
    const loadAccountData = async (
      accountId: string,
    ): Promise<Record<string, string> | null> => {
      try {
        const account = await this._client.getAccount(accountId);
        return (account.data ?? {}) as Record<string, string>;
      } catch {
        return null;
      }
    };
    await checkMemoRequired(memoType, operations, loadAccountData);
  }

  async fetchTimebounds(seconds: number): Promise<{ minTime: number; maxTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    return {
      minTime: 0,
      maxTime: now + seconds,
    };
  }

  friendbot(address: string): FriendbotBuilder {
    return new FriendbotBuilder(this.serverURL, this._headers, address);
  }

  private _extractEnvelope(tx: any): TransactionEnvelope {
    if (typeof tx === 'string') {
      return TransactionEnvelopeCodec.fromBase64(tx);
    }
    if (tx.toXDR) {
      return TransactionEnvelopeCodec.fromBase64(tx.toXDR());
    }
    return tx;
  }
}
