import { describe, it, expect, vi, afterEach } from 'vitest';
import { Horizon, Asset } from '../src/index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function halCollection<T>(records: T[], nextCursor?: string) {
  return {
    _links: {
      self: { href: 'https://horizon.stellar.org/test' },
      ...(nextCursor
        ? { next: { href: `https://horizon.stellar.org/test?cursor=${nextCursor}&limit=10` } }
        : {}),
    },
    _embedded: { records },
  };
}

function halRecord<T extends Record<string, unknown>>(record: T) {
  return {
    ...record,
    _links: { self: { href: 'https://horizon.stellar.org/test' } },
  };
}

function mockFetch(body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  });
  globalThis.fetch = fn;
  return fn;
}

function fetchUrl(fn: ReturnType<typeof vi.fn>): URL {
  return new URL(fn.mock.calls[0]![0] as string);
}

function chunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function mockStreamFetch(chunks: string[]) {
  const body = chunkedStream(chunks);
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    body,
  });
  globalThis.fetch = fn;
  return fn;
}

const server = new Horizon.Server('https://horizon.stellar.org');

// ---------------------------------------------------------------------------
// Server constructor
// ---------------------------------------------------------------------------

describe('Horizon.Server constructor', () => {
  it('stores server URL with trailing slash', () => {
    expect(server.serverURL).toBe('https://horizon.stellar.org/');
  });

  it('rejects HTTP by default', () => {
    expect(() => new Horizon.Server('http://localhost:8000')).toThrow();
  });

  it('allows HTTP with allowHttp', () => {
    const s = new Horizon.Server('http://localhost:8000', { allowHttp: true });
    expect(s.serverURL).toBe('http://localhost:8000/');
  });
});

// ---------------------------------------------------------------------------
// Direct methods
// ---------------------------------------------------------------------------

describe('root()', () => {
  it('fetches root', async () => {
    mockFetch({ network_passphrase: 'Test SDF Network ; September 2015' });
    const result = await server.root();
    expect(result.network_passphrase).toBe('Test SDF Network ; September 2015');
  });
});

describe('feeStats()', () => {
  it('fetches fee stats', async () => {
    mockFetch({
      last_ledger: '100',
      last_ledger_base_fee: '100',
      fee_charged: {},
      max_fee: {},
    });
    const result = await server.feeStats();
    expect(result.last_ledger).toBe('100');
  });
});

describe('fetchBaseFee()', () => {
  it('returns parsed base fee', async () => {
    mockFetch({
      last_ledger: '100',
      last_ledger_base_fee: '200',
      fee_charged: {},
      max_fee: {},
    });
    expect(await server.fetchBaseFee()).toBe(200);
  });
});

describe('loadAccount()', () => {
  it('returns AccountResponse usable with TransactionBuilder', async () => {
    mockFetch(halRecord({
      id: 'GABC',
      account_id: 'GABC',
      sequence: '42',
      balances: [],
      signers: [],
    }));
    const account = await server.loadAccount('GABC');
    expect(account.accountId()).toBe('GABC');
    expect(account.sequenceNumber()).toBe('42');
    expect(account).toBeInstanceOf(Horizon.AccountResponse);
    // Can increment sequence
    account.incrementSequenceNumber();
    expect(account.sequenceNumber()).toBe('43');
  });
});

// ---------------------------------------------------------------------------
// Call builders — pagination
// ---------------------------------------------------------------------------

describe('CallBuilder pagination', () => {
  it('cursor, limit, order are passed as query params', async () => {
    const fn = mockFetch(halCollection([]));
    await server.ledgers().cursor('abc').limit(5).order('desc').call();
    const url = fetchUrl(fn);
    expect(url.searchParams.get('cursor')).toBe('abc');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('order')).toBe('desc');
  });

  it('call() returns CollectionPage with records', async () => {
    mockFetch(halCollection([{ sequence: 1 }, { sequence: 2 }]));
    const page = await server.ledgers().call();
    expect(page.records).toHaveLength(2);
  });

  it('next() fetches the next page', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(halCollection(
          [{ sequence: 1 }],
          'cursor2',
        )),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(halCollection([{ sequence: 2 }])),
      });
    globalThis.fetch = fn;

    const page1 = await server.ledgers().call();
    expect(page1.records).toHaveLength(1);

    const page2 = await page1.next();
    expect(page2.records).toHaveLength(1);
    // Second fetch should use the next link URL
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('next() throws when no more pages', async () => {
    mockFetch(halCollection([{ sequence: 1 }]));
    const page = await server.ledgers().call();
    await expect(page.next()).rejects.toThrow('No more pages');
  });

  it('strips _links from records', async () => {
    mockFetch(halCollection([halRecord({ sequence: 1 })]));
    const page = await server.ledgers().call();
    expect('_links' in page.records[0]!).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LedgerCallBuilder
// ---------------------------------------------------------------------------

describe('LedgerCallBuilder', () => {
  it('call() hits /ledgers', async () => {
    const fn = mockFetch(halCollection([]));
    await server.ledgers().call();
    expect(fetchUrl(fn).pathname).toBe('/ledgers');
  });

  it('ledger() fetches single ledger', async () => {
    const fn = mockFetch(halRecord({ sequence: 42 }));
    const result = await server.ledgers().ledger(42).call();
    expect(result.sequence).toBe(42);
    expect(fetchUrl(fn).pathname).toBe('/ledgers/42');
  });
});

// ---------------------------------------------------------------------------
// AccountCallBuilder
// ---------------------------------------------------------------------------

describe('AccountCallBuilder', () => {
  it('call() hits /accounts', async () => {
    const fn = mockFetch(halCollection([]));
    await server.accounts().call();
    expect(fetchUrl(fn).pathname).toBe('/accounts');
  });

  it('accountId() fetches single account', async () => {
    const fn = mockFetch(halRecord({ id: 'GABC', account_id: 'GABC' }));
    const result = await server.accounts().accountId('GABC').call();
    expect(result.account_id).toBe('GABC');
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC');
  });

  it('forSigner() passes signer param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.accounts().forSigner('GSIGNER').call();
    expect(fetchUrl(fn).searchParams.get('signer')).toBe('GSIGNER');
  });

  it('forAsset() passes asset string', async () => {
    const fn = mockFetch(halCollection([]));
    await server.accounts().forAsset(new Asset('USD', 'GISSUER')).call();
    expect(fetchUrl(fn).searchParams.get('asset')).toBe('USD:GISSUER');
  });

  it('sponsor() passes sponsor param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.accounts().sponsor('GSPONSOR').call();
    expect(fetchUrl(fn).searchParams.get('sponsor')).toBe('GSPONSOR');
  });
});

// ---------------------------------------------------------------------------
// TransactionCallBuilder
// ---------------------------------------------------------------------------

describe('TransactionCallBuilder', () => {
  it('call() hits /transactions', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().call();
    expect(fetchUrl(fn).pathname).toBe('/transactions');
  });

  it('transaction() fetches single tx', async () => {
    const fn = mockFetch(halRecord({ hash: 'txhash' }));
    const result = await server.transactions().transaction('txhash').call();
    expect(result.hash).toBe('txhash');
    expect(fetchUrl(fn).pathname).toBe('/transactions/txhash');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/transactions');
  });

  it('forLedger() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().forLedger(42).call();
    expect(fetchUrl(fn).pathname).toBe('/ledgers/42/transactions');
  });

  it('includeFailed() passes param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().includeFailed(true).call();
    expect(fetchUrl(fn).searchParams.get('include_failed')).toBe('true');
  });

  it('forLiquidityPool() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().forLiquidityPool('pool1').call();
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools/pool1/transactions');
  });
});

// ---------------------------------------------------------------------------
// OperationCallBuilder
// ---------------------------------------------------------------------------

describe('OperationCallBuilder', () => {
  it('call() hits /operations', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().call();
    expect(fetchUrl(fn).pathname).toBe('/operations');
  });

  it('operation() fetches single op', async () => {
    const fn = mockFetch(halRecord({ id: '123', type: 'payment' }));
    const result = await server.operations().operation('123').call();
    expect(result.type).toBe('payment');
    expect(fetchUrl(fn).pathname).toBe('/operations/123');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/operations');
  });

  it('forTransaction() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().forTransaction('txhash').call();
    expect(fetchUrl(fn).pathname).toBe('/transactions/txhash/operations');
  });

  it('forLedger() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().forLedger(42).call();
    expect(fetchUrl(fn).pathname).toBe('/ledgers/42/operations');
  });

  it('includeFailed() passes param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().includeFailed(false).call();
    expect(fetchUrl(fn).searchParams.get('include_failed')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// PaymentCallBuilder
// ---------------------------------------------------------------------------

describe('PaymentCallBuilder', () => {
  it('call() hits /payments', async () => {
    const fn = mockFetch(halCollection([]));
    await server.payments().call();
    expect(fetchUrl(fn).pathname).toBe('/payments');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.payments().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/payments');
  });

  it('forLedger() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.payments().forLedger(42).call();
    expect(fetchUrl(fn).pathname).toBe('/ledgers/42/payments');
  });

  it('forTransaction() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.payments().forTransaction('txhash').call();
    expect(fetchUrl(fn).pathname).toBe('/transactions/txhash/payments');
  });
});

// ---------------------------------------------------------------------------
// EffectCallBuilder
// ---------------------------------------------------------------------------

describe('EffectCallBuilder', () => {
  it('call() hits /effects', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().call();
    expect(fetchUrl(fn).pathname).toBe('/effects');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/effects');
  });

  it('forLedger() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().forLedger(42).call();
    expect(fetchUrl(fn).pathname).toBe('/ledgers/42/effects');
  });

  it('forTransaction() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().forTransaction('txhash').call();
    expect(fetchUrl(fn).pathname).toBe('/transactions/txhash/effects');
  });

  it('forOperation() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().forOperation('456').call();
    expect(fetchUrl(fn).pathname).toBe('/operations/456/effects');
  });
});

// ---------------------------------------------------------------------------
// OfferCallBuilder
// ---------------------------------------------------------------------------

describe('OfferCallBuilder', () => {
  it('call() hits /offers', async () => {
    const fn = mockFetch(halCollection([]));
    await server.offers().call();
    expect(fetchUrl(fn).pathname).toBe('/offers');
  });

  it('offer() fetches single offer', async () => {
    const fn = mockFetch(halRecord({ id: '789', seller: 'GSELLER' }));
    const result = await server.offers().offer('789').call();
    expect(result.seller).toBe('GSELLER');
    expect(fetchUrl(fn).pathname).toBe('/offers/789');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.offers().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/offers');
  });

  it('selling() and buying() pass asset params', async () => {
    const fn = mockFetch(halCollection([]));
    await server.offers()
      .selling(Asset.native())
      .buying(new Asset('USD', 'GISSUER'))
      .call();
    const url = fetchUrl(fn);
    expect(url.searchParams.get('selling_asset_type')).toBe('native');
    expect(url.searchParams.get('buying_asset_type')).toBe('credit_alphanum4');
    expect(url.searchParams.get('buying_asset_code')).toBe('USD');
  });

  it('seller() passes seller param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.offers().seller('GSELLER').call();
    expect(fetchUrl(fn).searchParams.get('seller')).toBe('GSELLER');
  });
});

// ---------------------------------------------------------------------------
// TradesCallBuilder
// ---------------------------------------------------------------------------

describe('TradesCallBuilder', () => {
  it('call() hits /trades', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades().call();
    expect(fetchUrl(fn).pathname).toBe('/trades');
  });

  it('forAssetPair() passes asset params', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades()
      .forAssetPair(Asset.native(), new Asset('USD', 'GI'))
      .call();
    const url = fetchUrl(fn);
    expect(url.searchParams.get('base_asset_type')).toBe('native');
    expect(url.searchParams.get('counter_asset_code')).toBe('USD');
  });

  it('forOffer() passes offer_id', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades().forOffer('123').call();
    expect(fetchUrl(fn).searchParams.get('offer_id')).toBe('123');
  });

  it('forType() passes trade_type', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades().forType('liquidity_pool').call();
    expect(fetchUrl(fn).searchParams.get('trade_type')).toBe('liquidity_pool');
  });

  it('forAccount() changes path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades().forAccount('GABC').call();
    expect(fetchUrl(fn).pathname).toBe('/accounts/GABC/trades');
  });
});

// ---------------------------------------------------------------------------
// AssetsCallBuilder
// ---------------------------------------------------------------------------

describe('AssetsCallBuilder', () => {
  it('call() hits /assets', async () => {
    const fn = mockFetch(halCollection([]));
    await server.assets().call();
    expect(fetchUrl(fn).pathname).toBe('/assets');
  });

  it('forCode() and forIssuer() pass params', async () => {
    const fn = mockFetch(halCollection([]));
    await server.assets().forCode('USD').forIssuer('GISSUER').call();
    const url = fetchUrl(fn);
    expect(url.searchParams.get('asset_code')).toBe('USD');
    expect(url.searchParams.get('asset_issuer')).toBe('GISSUER');
  });
});

// ---------------------------------------------------------------------------
// ClaimableBalanceCallBuilder
// ---------------------------------------------------------------------------

describe('ClaimableBalanceCallBuilder', () => {
  it('call() hits /claimable_balances', async () => {
    const fn = mockFetch(halCollection([]));
    await server.claimableBalances().call();
    expect(fetchUrl(fn).pathname).toBe('/claimable_balances');
  });

  it('claimableBalance() fetches single record', async () => {
    const fn = mockFetch(halRecord({ id: 'cb1', amount: '100' }));
    const result = await server.claimableBalances().claimableBalance('cb1').call();
    expect(result.amount).toBe('100');
    expect(fetchUrl(fn).pathname).toBe('/claimable_balances/cb1');
  });

  it('sponsor() passes param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.claimableBalances().sponsor('GSPONSOR').call();
    expect(fetchUrl(fn).searchParams.get('sponsor')).toBe('GSPONSOR');
  });

  it('claimant() passes param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.claimableBalances().claimant('GCLAIMANT').call();
    expect(fetchUrl(fn).searchParams.get('claimant')).toBe('GCLAIMANT');
  });

  it('asset() passes asset string', async () => {
    const fn = mockFetch(halCollection([]));
    await server.claimableBalances().asset(Asset.native()).call();
    expect(fetchUrl(fn).searchParams.get('asset')).toBe('native');
  });
});

// ---------------------------------------------------------------------------
// LiquidityPoolCallBuilder
// ---------------------------------------------------------------------------

describe('LiquidityPoolCallBuilder', () => {
  it('call() hits /liquidity_pools', async () => {
    const fn = mockFetch(halCollection([]));
    await server.liquidityPools().call();
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools');
  });

  it('liquidityPoolId() fetches single pool', async () => {
    const fn = mockFetch(halRecord({ id: 'pool1', fee_bp: 30 }));
    const result = await server.liquidityPools().liquidityPoolId('pool1').call();
    expect(result.fee_bp).toBe(30);
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools/pool1');
  });

  it('forAssets() passes reserves param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.liquidityPools()
      .forAssets(Asset.native(), new Asset('USD', 'GISSUER'))
      .call();
    expect(fetchUrl(fn).searchParams.get('reserves')).toBe('native,USD:GISSUER');
  });

  it('forAccount() passes account param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.liquidityPools().forAccount('GABC').call();
    expect(fetchUrl(fn).searchParams.get('account')).toBe('GABC');
  });
});

// ---------------------------------------------------------------------------
// OrderbookCallBuilder
// ---------------------------------------------------------------------------

describe('OrderbookCallBuilder', () => {
  it('passes selling and buying asset params', async () => {
    const fn = mockFetch({ bids: [], asks: [], base: {}, counter: {} });
    await server.orderbook(Asset.native(), new Asset('USD', 'GISSUER')).call();
    const url = fetchUrl(fn);
    expect(url.pathname).toBe('/order_book');
    expect(url.searchParams.get('selling_asset_type')).toBe('native');
    expect(url.searchParams.get('buying_asset_type')).toBe('credit_alphanum4');
    expect(url.searchParams.get('buying_asset_code')).toBe('USD');
  });

  it('limit() passes limit param', async () => {
    const fn = mockFetch({ bids: [], asks: [], base: {}, counter: {} });
    await server.orderbook(Asset.native(), new Asset('USD', 'GI')).limit(20).call();
    expect(fetchUrl(fn).searchParams.get('limit')).toBe('20');
  });
});

// ---------------------------------------------------------------------------
// StrictReceivePathCallBuilder
// ---------------------------------------------------------------------------

describe('strictReceivePaths()', () => {
  it('passes source_account', async () => {
    const fn = mockFetch(halCollection([]));
    await server.strictReceivePaths('GSOURCE', Asset.native(), '100').call();
    const url = fetchUrl(fn);
    expect(url.pathname).toBe('/paths/strict-receive');
    expect(url.searchParams.get('source_account')).toBe('GSOURCE');
    expect(url.searchParams.get('destination_asset_type')).toBe('native');
    expect(url.searchParams.get('destination_amount')).toBe('100');
  });

  it('passes source_assets when array', async () => {
    const fn = mockFetch(halCollection([]));
    await server.strictReceivePaths(
      [Asset.native(), new Asset('EUR', 'GI')],
      new Asset('USD', 'GI'),
      '50',
    ).call();
    const url = fetchUrl(fn);
    expect(url.searchParams.get('source_assets')).toBe('native,EUR:GI');
  });
});

// ---------------------------------------------------------------------------
// StrictSendPathCallBuilder
// ---------------------------------------------------------------------------

describe('strictSendPaths()', () => {
  it('passes source asset and destination_account', async () => {
    const fn = mockFetch(halCollection([]));
    await server.strictSendPaths(Asset.native(), '100', 'GDEST').call();
    const url = fetchUrl(fn);
    expect(url.pathname).toBe('/paths/strict-send');
    expect(url.searchParams.get('source_asset_type')).toBe('native');
    expect(url.searchParams.get('source_amount')).toBe('100');
    expect(url.searchParams.get('destination_account')).toBe('GDEST');
  });

  it('passes destination_assets when array', async () => {
    const fn = mockFetch(halCollection([]));
    await server.strictSendPaths(
      Asset.native(),
      '100',
      [new Asset('EUR', 'GI')],
    ).call();
    expect(fetchUrl(fn).searchParams.get('destination_assets')).toBe('EUR:GI');
  });
});

// ---------------------------------------------------------------------------
// TradeAggregationCallBuilder
// ---------------------------------------------------------------------------

describe('tradeAggregation()', () => {
  it('passes all params', async () => {
    const fn = mockFetch(halCollection([]));
    await server.tradeAggregation(
      Asset.native(),
      new Asset('USD', 'GI'),
      1000000,
      2000000,
      3600000,
      0,
    ).call();
    const url = fetchUrl(fn);
    expect(url.pathname).toBe('/trade_aggregations');
    expect(url.searchParams.get('base_asset_type')).toBe('native');
    expect(url.searchParams.get('counter_asset_code')).toBe('USD');
    expect(url.searchParams.get('start_time')).toBe('1000000');
    expect(url.searchParams.get('end_time')).toBe('2000000');
    expect(url.searchParams.get('resolution')).toBe('3600000');
    expect(url.searchParams.get('offset')).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

describe('CallBuilder.stream()', () => {
  it('returns a close function', async () => {
    const fn = mockStreamFetch(['data: {"seq":1}\nid: 1\n\n']);
    const close = server.ledgers().cursor('now').stream({
      onmessage: () => {},
      onerror: () => {},
    });
    expect(typeof close).toBe('function');

    await new Promise((r) => setTimeout(r, 50));
    close();

    // Verify the SSE request was made
    const url = new URL(fn.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/ledgers');
    expect(url.searchParams.get('cursor')).toBe('now');
  });

  it('calls onmessage for each event', async () => {
    mockStreamFetch([
      'data: {"seq":1}\nid: 1\n\n',
      'data: {"seq":2}\nid: 2\n\n',
    ]);
    const messages: unknown[] = [];
    const close = server.ledgers().stream({
      onmessage: (msg) => messages.push(msg),
      onerror: () => {},
    });

    await new Promise((r) => setTimeout(r, 50));
    close();

    expect(messages).toEqual([{ seq: 1 }, { seq: 2 }]);
  });

  it('stream on forAccount scoped builder uses correct path', async () => {
    const fn = mockStreamFetch(['data: {}\n\n']);
    const close = server.transactions().forAccount('GABC').cursor('now').stream({
      onmessage: () => {},
      onerror: () => {},
    });

    await new Promise((r) => setTimeout(r, 50));
    close();

    const url = new URL(fn.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/accounts/GABC/transactions');
  });
});

// ---------------------------------------------------------------------------
// Fluent chaining
// ---------------------------------------------------------------------------

describe('fluent chaining', () => {
  it('methods return this for chaining', async () => {
    const fn = mockFetch(halCollection([]));
    const builder = server.transactions()
      .forAccount('GABC')
      .includeFailed(true)
      .cursor('abc')
      .limit(10)
      .order('desc');

    await builder.call();

    const url = fetchUrl(fn);
    expect(url.pathname).toBe('/accounts/GABC/transactions');
    expect(url.searchParams.get('include_failed')).toBe('true');
    expect(url.searchParams.get('cursor')).toBe('abc');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('order')).toBe('desc');
  });
});

// ---------------------------------------------------------------------------
// submitTransaction
// ---------------------------------------------------------------------------

describe('submitTransaction()', () => {
  it('sends XDR to /transactions', async () => {
    // Valid TransactionEnvelope base64 (v1, no ops, zero source, fee=100, seqNum=1)
    const validEnvelopeXdr =
      'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        hash: 'abc123',
        ledger: 42,
        envelope_xdr: validEnvelopeXdr,
        result_xdr: '',
        result_meta_xdr: '',
      }),
    });
    globalThis.fetch = fn;

    const fakeTx = { toXDR: () => validEnvelopeXdr };
    const result = await server.submitTransaction(fakeTx);
    expect(result.hash).toBe('abc123');
    expect(result.ledger).toBe(42);

    expect(fn).toHaveBeenCalledTimes(1);
    const call = fn.mock.calls[0]!;
    const url = new URL(call[0] as string);
    expect(url.pathname).toBe('/transactions');
  });
});

// ---------------------------------------------------------------------------
// submitAsyncTransaction
// ---------------------------------------------------------------------------

describe('submitAsyncTransaction()', () => {
  it('sends XDR to /transactions_async', async () => {
    const validEnvelopeXdr =
      'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({
        hash: 'def456',
        tx_status: 'PENDING',
      }),
    });
    globalThis.fetch = fn;

    const fakeTx = { toXDR: () => validEnvelopeXdr };
    const result = await server.submitAsyncTransaction(fakeTx);
    expect(result.hash).toBe('def456');
    expect(result.tx_status).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// LP sub-resource call builders
// ---------------------------------------------------------------------------

describe('LP sub-resource call builders', () => {
  it('operations().forLiquidityPool() uses LP path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().forLiquidityPool('pool1').call();
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools/pool1/operations');
  });

  it('effects().forLiquidityPool() uses LP path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.effects().forLiquidityPool('pool1').call();
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools/pool1/effects');
  });

  it('trades().forLiquidityPool() uses LP path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.trades().forLiquidityPool('pool1').call();
    expect(fetchUrl(fn).pathname).toBe('/liquidity_pools/pool1/trades');
  });

  it('transactions().forClaimableBalance() uses CB path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.transactions().forClaimableBalance('cb1').call();
    expect(fetchUrl(fn).pathname).toBe('/claimable_balances/cb1/transactions');
  });

  it('operations().forClaimableBalance() uses CB path', async () => {
    const fn = mockFetch(halCollection([]));
    await server.operations().forClaimableBalance('cb1').call();
    expect(fetchUrl(fn).pathname).toBe('/claimable_balances/cb1/operations');
  });

  it('accounts().forLiquidityPool() passes param', async () => {
    const fn = mockFetch(halCollection([]));
    await server.accounts().forLiquidityPool('pool1').call();
    expect(fetchUrl(fn).searchParams.get('liquidity_pool')).toBe('pool1');
  });
});

// ---------------------------------------------------------------------------
// Custom headers
// ---------------------------------------------------------------------------

describe('custom headers', () => {
  it('passes headers from ServerOptions to fetch', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(halCollection([])),
    });
    globalThis.fetch = fn;

    const customServer = new Horizon.Server('https://horizon.stellar.org', {
      headers: { 'X-Custom': 'test123' },
    });
    await customServer.ledgers().call();

    const fetchOpts = fn.mock.calls[0]![1] as RequestInit;
    const headers = fetchOpts.headers as Record<string, string>;
    expect(headers['X-Custom']).toBe('test123');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws HorizonError on HTTP failure', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ detail: 'Resource not found' }),
    });
    globalThis.fetch = fn;

    await expect(server.ledgers().call()).rejects.toThrow('HTTP 404');
  });

  it('includes status in error for 500', async () => {
    vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ title: 'Server Error' }),
    });

    await expect(server.accounts().call()).rejects.toThrow('HTTP 500');
  });
});

// ---------------------------------------------------------------------------
// Server URL variants
// ---------------------------------------------------------------------------

describe('server URL handling', () => {
  it('adds trailing slash to URL', () => {
    const s = new Horizon.Server('https://horizon.stellar.org');
    expect(s.serverURL).toBe('https://horizon.stellar.org/');
  });

  it('preserves trailing slash if present', () => {
    const s = new Horizon.Server('https://horizon.stellar.org/');
    expect(s.serverURL).toBe('https://horizon.stellar.org/');
  });
});

// ---------------------------------------------------------------------------
// Streaming error/close handling
// ---------------------------------------------------------------------------

describe('streaming edge cases', () => {
  it('onerror is called on malformed SSE data', async () => {
    mockStreamFetch(['invalid data without data: prefix\n\n']);
    const errors: Error[] = [];
    const close = server.ledgers().stream({
      onmessage: () => {},
      onerror: (e) => errors.push(e),
    });

    await new Promise((r) => setTimeout(r, 50));
    close();
    // The stream should handle gracefully without crashing
  });

  it('close can be called multiple times safely', async () => {
    mockStreamFetch(['data: {"seq":1}\n\n']);
    const close = server.ledgers().stream({
      onmessage: () => {},
    });

    await new Promise((r) => setTimeout(r, 50));
    close();
    // Should not throw
    close();
  });
});
