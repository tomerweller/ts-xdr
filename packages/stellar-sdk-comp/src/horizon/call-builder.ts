/**
 * Call builder pattern for Horizon API, compatible with js-stellar-sdk.
 *
 * Usage:
 *   const page = await server.ledgers().limit(10).order('desc').call();
 *   const close = server.ledgers().cursor('now').stream({ onmessage: ... });
 */

import { sseStream, HorizonError } from '@stellar/horizon-client';
import type { Asset } from '@stellar/stellar-base-comp';
import type { CollectionPage } from './api.js';
import type {
  LedgerRecord,
  TransactionRecord,
  OperationRecord,
  EffectRecord,
  OfferRecord,
  TradeRecord,
  AssetRecord,
  ClaimableBalanceRecord,
  LiquidityPoolRecord,
  OrderBookResponse,
  PathRecord,
  TradeAggregationRecord,
} from '@stellar/horizon-client';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface HalResponse<T> {
  _links: {
    self: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
  _embedded: { records: T[] };
}

function stripLinks<T>(record: T & { _links?: unknown }): T {
  const { _links, ...rest } = record as any;
  return rest as T;
}

function assetToParams(prefix: string, asset: Asset): Record<string, string> {
  if (asset.isNative()) return { [`${prefix}_asset_type`]: 'native' };
  return {
    [`${prefix}_asset_type`]: asset.getAssetType(),
    [`${prefix}_asset_code`]: asset.getCode(),
    [`${prefix}_asset_issuer`]: asset.getIssuer()!,
  };
}

function assetToString(asset: Asset): string {
  if (asset.isNative()) return 'native';
  return `${asset.getCode()}:${asset.getIssuer()}`;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
  });
  if (!res.ok) {
    let body: any;
    try { body = await res.json(); } catch { /* not JSON */ }
    throw new HorizonError(res.status, `HTTP ${res.status}: ${res.statusText}`, body);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// CallBuilder<T> — base class for paginated collection endpoints
// ---------------------------------------------------------------------------

export class CallBuilder<T> {
  protected _serverUrl: string;
  protected _headers: Record<string, string>;
  protected _segments: string[];
  protected _params: Record<string, string> = {};
  protected _cursor?: string;
  protected _limit?: number;
  protected _order?: 'asc' | 'desc';

  constructor(serverUrl: string, headers: Record<string, string>, ...segments: string[]) {
    this._serverUrl = serverUrl;
    this._headers = headers;
    this._segments = segments;
  }

  cursor(cursor: string): this {
    this._cursor = cursor;
    return this;
  }

  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  order(direction: 'asc' | 'desc'): this {
    this._order = direction;
    return this;
  }

  protected _buildUrl(): URL {
    const path = this._segments.join('/');
    const url = new URL(path, this._serverUrl);
    for (const [k, v] of Object.entries(this._params)) {
      url.searchParams.set(k, v);
    }
    if (this._cursor) url.searchParams.set('cursor', this._cursor);
    if (this._limit !== undefined) url.searchParams.set('limit', String(this._limit));
    if (this._order) url.searchParams.set('order', this._order);
    return url;
  }

  async call(): Promise<CollectionPage<T>> {
    const url = this._buildUrl();
    const body = await fetchJson<HalResponse<T>>(url.toString(), this._headers);
    return this._toCollectionPage(body);
  }

  stream(opts: {
    onmessage?: (record: T) => void;
    onerror?: (error: Error) => void;
    reconnectTimeout?: number;
  }): () => void {
    const path = this._segments.join('/');
    const params = { ...this._params };
    const handle = sseStream<T>(
      this._serverUrl,
      path,
      params,
      this._headers,
      {
        cursor: this._cursor,
        onMessage: opts.onmessage ?? (() => {}),
        onError: opts.onerror,
      },
    );
    return () => handle.close();
  }

  protected _toCollectionPage(body: HalResponse<T>): CollectionPage<T> {
    const records = (body._embedded?.records ?? []).map((r) =>
      stripLinks(r as T & { _links?: unknown }),
    );
    return {
      records,
      next: () => this._fetchPage(body._links?.next?.href),
      prev: () => this._fetchPage(body._links?.prev?.href),
    };
  }

  private async _fetchPage(href?: string): Promise<CollectionPage<T>> {
    if (!href) throw new HorizonError(0, 'No more pages available');
    const body = await fetchJson<HalResponse<T>>(href, this._headers);
    return this._toCollectionPage(body);
  }

  /** Fetch a single record (for single-item builder methods). */
  protected _singleRecord(
    ...segments: string[]
  ): { call(): Promise<T> } {
    const serverUrl = this._serverUrl;
    const headers = this._headers;
    return {
      async call(): Promise<T> {
        const url = new URL(segments.join('/'), serverUrl);
        const body = await fetchJson<T & { _links?: unknown }>(url.toString(), headers);
        return stripLinks(body);
      },
    };
  }
}

// ---------------------------------------------------------------------------
// AccountCallBuilder
// ---------------------------------------------------------------------------

export class AccountCallBuilder extends CallBuilder<import('@stellar/horizon-client').AccountRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'accounts');
  }

  accountId(id: string) {
    return this._singleRecord('accounts', id);
  }

  forSigner(id: string): this {
    this._params.signer = id;
    return this;
  }

  forAsset(asset: Asset): this {
    this._params.asset = assetToString(asset);
    return this;
  }

  sponsor(id: string): this {
    this._params.sponsor = id;
    return this;
  }

  forLiquidityPool(id: string): this {
    this._params.liquidity_pool = id;
    return this;
  }
}

// ---------------------------------------------------------------------------
// LedgerCallBuilder
// ---------------------------------------------------------------------------

export class LedgerCallBuilder extends CallBuilder<LedgerRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'ledgers');
  }

  ledger(sequence: number) {
    return this._singleRecord('ledgers', String(sequence));
  }
}

// ---------------------------------------------------------------------------
// TransactionCallBuilder
// ---------------------------------------------------------------------------

export class TransactionCallBuilder extends CallBuilder<TransactionRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'transactions');
  }

  transaction(id: string) {
    return this._singleRecord('transactions', id);
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'transactions'];
    return this;
  }

  forLedger(sequence: number): this {
    this._segments = ['ledgers', String(sequence), 'transactions'];
    return this;
  }

  forClaimableBalance(balanceId: string): this {
    this._segments = ['claimable_balances', balanceId, 'transactions'];
    return this;
  }

  forLiquidityPool(poolId: string): this {
    this._segments = ['liquidity_pools', poolId, 'transactions'];
    return this;
  }

  includeFailed(include: boolean): this {
    this._params.include_failed = String(include);
    return this;
  }
}

// ---------------------------------------------------------------------------
// OperationCallBuilder
// ---------------------------------------------------------------------------

export class OperationCallBuilder extends CallBuilder<OperationRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'operations');
  }

  operation(id: string) {
    return this._singleRecord('operations', id);
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'operations'];
    return this;
  }

  forLedger(sequence: number): this {
    this._segments = ['ledgers', String(sequence), 'operations'];
    return this;
  }

  forTransaction(hash: string): this {
    this._segments = ['transactions', hash, 'operations'];
    return this;
  }

  forClaimableBalance(balanceId: string): this {
    this._segments = ['claimable_balances', balanceId, 'operations'];
    return this;
  }

  forLiquidityPool(poolId: string): this {
    this._segments = ['liquidity_pools', poolId, 'operations'];
    return this;
  }

  includeFailed(include: boolean): this {
    this._params.include_failed = String(include);
    return this;
  }

  join(param: string): this {
    this._params.join = param;
    return this;
  }
}

// ---------------------------------------------------------------------------
// PaymentCallBuilder
// ---------------------------------------------------------------------------

export class PaymentCallBuilder extends CallBuilder<OperationRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'payments');
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'payments'];
    return this;
  }

  forLedger(sequence: number): this {
    this._segments = ['ledgers', String(sequence), 'payments'];
    return this;
  }

  forTransaction(hash: string): this {
    this._segments = ['transactions', hash, 'payments'];
    return this;
  }

  includeFailed(include: boolean): this {
    this._params.include_failed = String(include);
    return this;
  }
}

// ---------------------------------------------------------------------------
// EffectCallBuilder
// ---------------------------------------------------------------------------

export class EffectCallBuilder extends CallBuilder<EffectRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'effects');
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'effects'];
    return this;
  }

  forLedger(sequence: number): this {
    this._segments = ['ledgers', String(sequence), 'effects'];
    return this;
  }

  forTransaction(hash: string): this {
    this._segments = ['transactions', hash, 'effects'];
    return this;
  }

  forOperation(id: string): this {
    this._segments = ['operations', id, 'effects'];
    return this;
  }

  forLiquidityPool(poolId: string): this {
    this._segments = ['liquidity_pools', poolId, 'effects'];
    return this;
  }
}

// ---------------------------------------------------------------------------
// OfferCallBuilder
// ---------------------------------------------------------------------------

export class OfferCallBuilder extends CallBuilder<OfferRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'offers');
  }

  offer(id: string) {
    return this._singleRecord('offers', id);
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'offers'];
    return this;
  }

  selling(asset: Asset): this {
    Object.assign(this._params, assetToParams('selling', asset));
    return this;
  }

  buying(asset: Asset): this {
    Object.assign(this._params, assetToParams('buying', asset));
    return this;
  }

  seller(id: string): this {
    this._params.seller = id;
    return this;
  }

  sponsor(id: string): this {
    this._params.sponsor = id;
    return this;
  }
}

// ---------------------------------------------------------------------------
// TradesCallBuilder
// ---------------------------------------------------------------------------

export class TradesCallBuilder extends CallBuilder<TradeRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'trades');
  }

  forAssetPair(base: Asset, counter: Asset): this {
    Object.assign(this._params, assetToParams('base', base));
    Object.assign(this._params, assetToParams('counter', counter));
    return this;
  }

  forOffer(offerId: string): this {
    this._params.offer_id = offerId;
    return this;
  }

  forType(tradeType: 'orderbook' | 'liquidity_pool' | 'all'): this {
    this._params.trade_type = tradeType;
    return this;
  }

  forAccount(accountId: string): this {
    this._segments = ['accounts', accountId, 'trades'];
    return this;
  }

  forLiquidityPool(poolId: string): this {
    this._segments = ['liquidity_pools', poolId, 'trades'];
    return this;
  }
}

// ---------------------------------------------------------------------------
// AssetsCallBuilder
// ---------------------------------------------------------------------------

export class AssetsCallBuilder extends CallBuilder<AssetRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'assets');
  }

  forCode(code: string): this {
    this._params.asset_code = code;
    return this;
  }

  forIssuer(issuer: string): this {
    this._params.asset_issuer = issuer;
    return this;
  }
}

// ---------------------------------------------------------------------------
// ClaimableBalanceCallBuilder
// ---------------------------------------------------------------------------

export class ClaimableBalanceCallBuilder extends CallBuilder<ClaimableBalanceRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'claimable_balances');
  }

  claimableBalance(id: string) {
    return this._singleRecord('claimable_balances', id);
  }

  sponsor(id: string): this {
    this._params.sponsor = id;
    return this;
  }

  claimant(id: string): this {
    this._params.claimant = id;
    return this;
  }

  asset(asset: Asset): this {
    this._params.asset = assetToString(asset);
    return this;
  }
}

// ---------------------------------------------------------------------------
// LiquidityPoolCallBuilder
// ---------------------------------------------------------------------------

export class LiquidityPoolCallBuilder extends CallBuilder<LiquidityPoolRecord> {
  constructor(serverUrl: string, headers: Record<string, string>) {
    super(serverUrl, headers, 'liquidity_pools');
  }

  liquidityPoolId(id: string) {
    return this._singleRecord('liquidity_pools', id);
  }

  forAssets(...assets: Asset[]): this {
    this._params.reserves = assets.map(assetToString).join(',');
    return this;
  }

  forAccount(accountId: string): this {
    this._params.account = accountId;
    return this;
  }
}

// ---------------------------------------------------------------------------
// OrderbookCallBuilder — non-paginated, returns OrderBookResponse directly
// ---------------------------------------------------------------------------

export class OrderbookCallBuilder {
  private _serverUrl: string;
  private _headers: Record<string, string>;
  private _params: Record<string, string>;
  private _limit?: number;

  constructor(
    serverUrl: string,
    headers: Record<string, string>,
    selling: Asset,
    buying: Asset,
  ) {
    this._serverUrl = serverUrl;
    this._headers = headers;
    this._params = {
      ...assetToParams('selling', selling),
      ...assetToParams('buying', buying),
    };
  }

  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  async call(): Promise<OrderBookResponse> {
    const url = new URL('order_book', this._serverUrl);
    for (const [k, v] of Object.entries(this._params)) {
      url.searchParams.set(k, v);
    }
    if (this._limit !== undefined) url.searchParams.set('limit', String(this._limit));
    return fetchJson<OrderBookResponse>(url.toString(), this._headers);
  }

  stream(opts: {
    onmessage?: (record: OrderBookResponse) => void;
    onerror?: (error: Error) => void;
  }): () => void {
    const handle = sseStream<OrderBookResponse>(
      this._serverUrl,
      'order_book',
      { ...this._params },
      this._headers,
      {
        onMessage: opts.onmessage ?? (() => {}),
        onError: opts.onerror,
      },
    );
    return () => handle.close();
  }
}

// ---------------------------------------------------------------------------
// StrictReceivePathCallBuilder
// ---------------------------------------------------------------------------

export class StrictReceivePathCallBuilder extends CallBuilder<PathRecord> {
  constructor(
    serverUrl: string,
    headers: Record<string, string>,
    source: string | Asset[],
    destinationAsset: Asset,
    destinationAmount: string,
  ) {
    super(serverUrl, headers, 'paths', 'strict-receive');
    Object.assign(this._params, assetToParams('destination', destinationAsset));
    this._params.destination_amount = destinationAmount;
    if (typeof source === 'string') {
      this._params.source_account = source;
    } else {
      this._params.source_assets = source.map(assetToString).join(',');
    }
  }
}

// ---------------------------------------------------------------------------
// StrictSendPathCallBuilder
// ---------------------------------------------------------------------------

export class StrictSendPathCallBuilder extends CallBuilder<PathRecord> {
  constructor(
    serverUrl: string,
    headers: Record<string, string>,
    sourceAsset: Asset,
    sourceAmount: string,
    destination: string | Asset[],
  ) {
    super(serverUrl, headers, 'paths', 'strict-send');
    Object.assign(this._params, assetToParams('source', sourceAsset));
    this._params.source_amount = sourceAmount;
    if (typeof destination === 'string') {
      this._params.destination_account = destination;
    } else {
      this._params.destination_assets = destination.map(assetToString).join(',');
    }
  }
}

// ---------------------------------------------------------------------------
// TradeAggregationCallBuilder
// ---------------------------------------------------------------------------

export class TradeAggregationCallBuilder extends CallBuilder<TradeAggregationRecord> {
  constructor(
    serverUrl: string,
    headers: Record<string, string>,
    base: Asset,
    counter: Asset,
    startTime: number,
    endTime: number,
    resolution: number,
    offset?: number,
  ) {
    super(serverUrl, headers, 'trade_aggregations');
    Object.assign(this._params, assetToParams('base', base));
    Object.assign(this._params, assetToParams('counter', counter));
    this._params.start_time = String(startTime);
    this._params.end_time = String(endTime);
    this._params.resolution = String(resolution);
    if (offset !== undefined) this._params.offset = String(offset);
  }
}

// ---------------------------------------------------------------------------
// OfferTradesCallBuilder — for /offers/{id}/trades
// ---------------------------------------------------------------------------

export class OfferTradesCallBuilder extends CallBuilder<TradeRecord> {
  constructor(serverUrl: string, headers: Record<string, string>, offerId: string) {
    super(serverUrl, headers, 'offers', offerId, 'trades');
  }
}

// ---------------------------------------------------------------------------
// FriendbotBuilder — for /friendbot?addr=...
// ---------------------------------------------------------------------------

export class FriendbotBuilder extends CallBuilder<any> {
  constructor(serverUrl: string, headers: Record<string, string>, address: string) {
    super(serverUrl, headers, 'friendbot');
    this._params.addr = address;
  }
}
