import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  LedgerKey,
  TransactionEnvelope,
  TransactionResult,
  TransactionMeta,
  DiagnosticEvent,
  SCVal,
  SorobanTransactionData,
  SorobanAuthorizationEntry,
  LedgerEntryData,
  AccountEntry,
  LedgerHeader,
  LedgerCloseMeta,
  LedgerHeaderHistoryEntry,
} from '@stellar/xdr';
import { RpcClient } from '../src/client.js';
import { RpcError } from '../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_URL = 'https://rpc.example.com';
const originalFetch = globalThis.fetch;

function mockRpcResponse(result: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
  });
  globalThis.fetch = fn;
  return fn;
}

function mockRpcSequence(results: unknown[]) {
  let call = 0;
  const fn = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ jsonrpc: '2.0', id: call, result: results[call++] }),
    }),
  );
  globalThis.fetch = fn;
  return fn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('RpcClient constructor', () => {
  it('accepts https URLs', () => {
    const client = new RpcClient(TEST_URL);
    expect(client.url).toBe(TEST_URL);
  });

  it('rejects http URLs by default', () => {
    expect(() => new RpcClient('http://localhost:8000')).toThrow(RpcError);
  });

  it('allows http with allowHttp option', () => {
    const client = new RpcClient('http://localhost:8000', { allowHttp: true });
    expect(client.url).toBe('http://localhost:8000');
  });
});

// ---------------------------------------------------------------------------
// Simple RPC methods (no XDR decoding)
// ---------------------------------------------------------------------------

describe('getHealth', () => {
  it('returns health response', async () => {
    const expected = { status: 'healthy', latestLedger: 100, oldestLedger: 1, ledgerRetentionWindow: 17280 };
    mockRpcResponse(expected);

    const client = new RpcClient(TEST_URL);
    const result = await client.getHealth();
    expect(result).toEqual(expected);
  });
});

describe('getNetwork', () => {
  it('returns network response', async () => {
    const expected = {
      passphrase: 'Test SDF Network ; September 2015',
      protocolVersion: 21,
      friendbotUrl: 'https://friendbot.stellar.org',
    };
    mockRpcResponse(expected);

    const client = new RpcClient(TEST_URL);
    const result = await client.getNetwork();
    expect(result).toEqual(expected);
  });
});

describe('getVersionInfo', () => {
  it('returns version info', async () => {
    const expected = {
      version: '21.0.0',
      commitHash: 'abc123',
      buildTimestamp: '2024-01-01T00:00:00Z',
      captiveCoreVersion: '21.0.0',
      protocolVersion: 21,
    };
    mockRpcResponse(expected);

    const client = new RpcClient(TEST_URL);
    const result = await client.getVersionInfo();
    expect(result).toEqual(expected);
  });
});

describe('getFeeStats', () => {
  it('returns fee stats', async () => {
    const dist = {
      max: '200', min: '100', mode: '100',
      p10: '100', p20: '100', p30: '100', p40: '100', p50: '100',
      p60: '100', p70: '100', p80: '100', p90: '100', p95: '150', p99: '200',
      transactionCount: '10', ledgerCount: 5,
    };
    const expected = { sorobanInclusionFee: dist, inclusionFee: dist, latestLedger: 100 };
    mockRpcResponse(expected);

    const client = new RpcClient(TEST_URL);
    const result = await client.getFeeStats();
    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getTransaction
// ---------------------------------------------------------------------------

describe('getTransaction', () => {
  it('returns NOT_FOUND without XDR fields', async () => {
    mockRpcResponse({
      status: 'NOT_FOUND',
      latestLedger: 100,
      latestLedgerCloseTime: 1700000000,
      oldestLedger: 1,
      oldestLedgerCloseTime: 1690000000,
    });

    const client = new RpcClient(TEST_URL);
    const result = await client.getTransaction('deadbeef');
    expect(result.status).toBe('NOT_FOUND');
    expect(result.envelopeXdr).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendTransaction
// ---------------------------------------------------------------------------

describe('sendTransaction', () => {
  it('encodes envelope and sends', async () => {
    const fetchFn = mockRpcResponse({
      hash: 'abc123',
      status: 'PENDING',
      latestLedger: 100,
      latestLedgerCloseTime: 1700000000,
    });

    // Create a minimal valid TransactionEnvelope
    const envelope: TransactionEnvelope = {
      Tx: {
        tx: {
          sourceAccount: { Ed25519: new Uint8Array(32) },
          fee: 100,
          seqNum: 1n,
          cond: 'None',
          memo: 'None',
          operations: [],
          ext: '0',
        },
        signatures: [],
      },
    };

    const client = new RpcClient(TEST_URL);
    const result = await client.sendTransaction(envelope);
    expect(result.status).toBe('PENDING');
    expect(result.hash).toBe('abc123');

    // Verify the transaction was encoded to base64
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.params.transaction).toBeDefined();
    expect(typeof body.params.transaction).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// simulateTransaction
// ---------------------------------------------------------------------------

describe('simulateTransaction', () => {
  it('passes resourceLeeway and authMode', async () => {
    const fetchFn = mockRpcResponse({
      error: 'some error',
      latestLedger: 100,
    });

    const envelope: TransactionEnvelope = {
      Tx: {
        tx: {
          sourceAccount: { Ed25519: new Uint8Array(32) },
          fee: 100,
          seqNum: 1n,
          cond: 'None',
          memo: 'None',
          operations: [],
          ext: '0',
        },
        signatures: [],
      },
    };

    const client = new RpcClient(TEST_URL);
    await client.simulateTransaction(envelope, {
      resourceLeeway: 50,
      authMode: 'record',
    });

    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.params.resourceConfig).toEqual({ instructionLeeway: 50 });
    expect(body.params.simulationAuthMode).toBe('record');
  });
});

// ---------------------------------------------------------------------------
// getLedgerEntries
// ---------------------------------------------------------------------------

describe('getLedgerEntries', () => {
  it('encodes keys and parses entries', async () => {
    const key: LedgerKey = { Account: { accountID: { PublicKeyTypeEd25519: new Uint8Array(32) } } };
    const keyBase64 = LedgerKey.toBase64(key);

    // Create LedgerEntryData for the response (RPC returns data union, not full LedgerEntry)
    const data: LedgerEntryData = {
      Account: {
        accountID: { PublicKeyTypeEd25519: new Uint8Array(32) },
        balance: 10000000n,
        seqNum: 42n,
        numSubEntries: 0,
        inflationDest: null,
        flags: 0,
        homeDomain: '',
        thresholds: new Uint8Array([1, 0, 0, 0]),
        signers: [],
        ext: '0',
      },
    };

    const fetchFn = mockRpcResponse({
      latestLedger: 100,
      entries: [
        {
          key: keyBase64,
          xdr: LedgerEntryData.toBase64(data),
          lastModifiedLedgerSeq: 50,
        },
      ],
    });

    const client = new RpcClient(TEST_URL);
    const result = await client.getLedgerEntries([key]);
    expect(result.latestLedger).toBe(100);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.lastModifiedLedgerSeq).toBe(50);

    // Verify the key was encoded in the request
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.params.keys).toEqual([keyBase64]);
  });

  it('handles empty entries', async () => {
    mockRpcResponse({ latestLedger: 100 });

    const client = new RpcClient(TEST_URL);
    const result = await client.getLedgerEntries([]);
    expect(result.entries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAccount
// ---------------------------------------------------------------------------

describe('getAccount', () => {
  it('returns AccountEntry for a valid account', async () => {
    const pubkeyBytes = new Uint8Array(32);
    const accountEntry: AccountEntry = {
      accountID: { PublicKeyTypeEd25519: pubkeyBytes },
      balance: 50000000n,
      seqNum: 12345n,
      numSubEntries: 0,
      inflationDest: null,
      flags: 0,
      homeDomain: '',
      thresholds: new Uint8Array([1, 0, 0, 0]),
      signers: [],
      ext: '0',
    };

    const data: LedgerEntryData = { Account: accountEntry };

    const key: LedgerKey = { Account: { accountID: { PublicKeyTypeEd25519: pubkeyBytes } } };

    mockRpcResponse({
      latestLedger: 100,
      entries: [{
        key: LedgerKey.toBase64(key),
        xdr: LedgerEntryData.toBase64(data),
        lastModifiedLedgerSeq: 50,
      }],
    });

    const client = new RpcClient(TEST_URL);
    // Use a well-known test address (all-zero pubkey encoded as G-address)
    const gAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const result = await client.getAccount(gAddress);
    expect(result.seqNum).toBe(12345n);
    expect(result.balance).toBe(50000000n);
  });

  it('throws when account not found', async () => {
    mockRpcResponse({ latestLedger: 100 });

    const client = new RpcClient(TEST_URL);
    await expect(
      client.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'),
    ).rejects.toThrow('Account not found');
  });
});

// ---------------------------------------------------------------------------
// pollTransaction
// ---------------------------------------------------------------------------

describe('pollTransaction', () => {
  it('polls until status changes from NOT_FOUND', async () => {
    mockRpcSequence([
      {
        status: 'NOT_FOUND',
        latestLedger: 100,
        latestLedgerCloseTime: 1700000000,
        oldestLedger: 1,
        oldestLedgerCloseTime: 1690000000,
      },
      {
        status: 'NOT_FOUND',
        latestLedger: 101,
        latestLedgerCloseTime: 1700000005,
        oldestLedger: 1,
        oldestLedgerCloseTime: 1690000000,
      },
      {
        status: 'SUCCESS',
        latestLedger: 102,
        latestLedgerCloseTime: 1700000010,
        oldestLedger: 1,
        oldestLedgerCloseTime: 1690000000,
        ledger: 102,
        createdAt: 1700000010,
      },
    ]);

    const client = new RpcClient(TEST_URL);
    const result = await client.pollTransaction('hash123', {
      attempts: 5,
      sleepStrategy: () => 0, // no delay for tests
    });
    expect(result.status).toBe('SUCCESS');
  });

  it('throws after max attempts', async () => {
    const notFound = {
      status: 'NOT_FOUND',
      latestLedger: 100,
      latestLedgerCloseTime: 1700000000,
      oldestLedger: 1,
      oldestLedgerCloseTime: 1690000000,
    };
    mockRpcSequence([notFound, notFound, notFound]);

    const client = new RpcClient(TEST_URL);
    await expect(
      client.pollTransaction('hash123', { attempts: 3, sleepStrategy: () => 0 }),
    ).rejects.toThrow('not found after 3 attempts');
  });
});

// ---------------------------------------------------------------------------
// prepareTransaction
// ---------------------------------------------------------------------------

describe('prepareTransaction', () => {
  it('throws on simulation error', async () => {
    mockRpcResponse({ error: 'something went wrong', latestLedger: 100 });

    const envelope: TransactionEnvelope = {
      Tx: {
        tx: {
          sourceAccount: { Ed25519: new Uint8Array(32) },
          fee: 100,
          seqNum: 1n,
          cond: 'None',
          memo: 'None',
          operations: [],
          ext: '0',
        },
        signatures: [],
      },
    };

    const client = new RpcClient(TEST_URL);
    await expect(client.prepareTransaction(envelope)).rejects.toThrow('Simulation failed');
  });
});
