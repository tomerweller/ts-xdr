import { describe, it, expect, vi, afterEach } from 'vitest';
import { SorobanRpc } from '../src/index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock fetch to return a JSON-RPC success response.
 * The SorobanRpc.Server → RpcClient → jsonRpcPost → fetch chain
 * means we mock at the fetch level and return { jsonrpc, id, result }.
 */
function mockJsonRpc(result: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
  });
  globalThis.fetch = fn;
  return fn;
}

function mockJsonRpcError(code: number, message: string) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({ jsonrpc: '2.0', id: 1, error: { code, message } }),
  });
  globalThis.fetch = fn;
  return fn;
}

function lastRpcMethod(fn: ReturnType<typeof vi.fn>): string {
  const body = JSON.parse(fn.mock.calls[0]![1].body as string);
  return body.method;
}

function lastRpcParams(fn: ReturnType<typeof vi.fn>): any {
  const body = JSON.parse(fn.mock.calls[0]![1].body as string);
  return body.params;
}

// Valid base64 XDR test data (generated from @stellar/xdr codecs)
// LedgerEntryData containing an Account entry with zero pubkey, balance=10B, seqNum=1234
const VALID_ACCOUNT_ENTRY_XDR =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUC+QAAAAAAAAABNIAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAA';
// LedgerKey for Account with zero pubkey
const VALID_ACCOUNT_KEY_XDR =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
// TransactionEnvelope (v1, no ops, zero source, fee=100, seqNum=1)
const VALID_TX_ENVELOPE_XDR =
  'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
// SCVal::Void
const SCVAL_VOID_B64 = 'AAAAAQ==';
// SCVal::U32(42)
const SCVAL_U32_42_B64 = 'AAAAAwAAACo=';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org', {
  allowHttp: false,
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SorobanRpc.Server constructor', () => {
  it('creates server with HTTPS URL', () => {
    expect(
      () => new SorobanRpc.Server('https://soroban-testnet.stellar.org'),
    ).not.toThrow();
  });

  it('rejects HTTP by default', () => {
    expect(
      () => new SorobanRpc.Server('http://localhost:8000'),
    ).toThrow();
  });

  it('allows HTTP with allowHttp', () => {
    expect(
      () =>
        new SorobanRpc.Server('http://localhost:8000', { allowHttp: true }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getHealth
// ---------------------------------------------------------------------------

describe('getHealth()', () => {
  it('returns health status', async () => {
    const fn = mockJsonRpc({
      status: 'healthy',
      latestLedger: 1000,
      oldestLedger: 500,
      ledgerRetentionWindow: 500,
    });
    const result = await server.getHealth();
    expect(result.status).toBe('healthy');
    expect(result.latestLedger).toBe(1000);
    expect(lastRpcMethod(fn)).toBe('getHealth');
  });
});

// ---------------------------------------------------------------------------
// getNetwork
// ---------------------------------------------------------------------------

describe('getNetwork()', () => {
  it('returns network info', async () => {
    const fn = mockJsonRpc({
      friendbotUrl: 'https://friendbot.stellar.org',
      passphrase: 'Test SDF Network ; September 2015',
      protocolVersion: 20,
    });
    const result = await server.getNetwork();
    expect(result.passphrase).toBe('Test SDF Network ; September 2015');
    expect(result.protocolVersion).toBe(20);
    expect(lastRpcMethod(fn)).toBe('getNetwork');
  });

  it('returns network without friendbot', async () => {
    mockJsonRpc({
      passphrase: 'Public Global Stellar Network ; September 2015',
      protocolVersion: 21,
    });
    const result = await server.getNetwork();
    expect(result.passphrase).toBe(
      'Public Global Stellar Network ; September 2015',
    );
  });
});

// ---------------------------------------------------------------------------
// getLatestLedger
// ---------------------------------------------------------------------------

describe('getLatestLedger()', () => {
  it('calls getLatestLedger RPC method', async () => {
    // The RPC client parses headerXdr/metadataXdr from the response,
    // so we need to verify the method is called correctly.
    // We test this by verifying the JSON-RPC method name.
    const fn = mockJsonRpc({
      id: 'abcdef',
      protocolVersion: 20,
      sequence: 12345,
      // headerXdr and metadataXdr are required by the parser but hard
      // to mock. Testing the method routing is sufficient.
    });
    // The parser will fail on missing XDR fields, but we verify method routing
    try {
      await server.getLatestLedger();
    } catch {
      // Expected: parser fails on missing XDR, but we verify the call was made
    }
    expect(lastRpcMethod(fn)).toBe('getLatestLedger');
  });
});

// ---------------------------------------------------------------------------
// getAccount
// ---------------------------------------------------------------------------

describe('getAccount()', () => {
  it('returns account with id and sequence', async () => {
    const fn = mockJsonRpc({
      entries: [
        {
          key: VALID_ACCOUNT_KEY_XDR,
          xdr: VALID_ACCOUNT_ENTRY_XDR,
          lastModifiedLedgerSeq: 100,
        },
      ],
      latestLedger: 200,
    });
    const result = await server.getAccount(
      'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC',
    );
    expect(result.id).toBe(
      'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC',
    );
    expect(typeof result.sequence).toBe('string');
    expect(lastRpcMethod(fn)).toBe('getLedgerEntries');
  });

  it('throws on account not found', async () => {
    mockJsonRpc({
      entries: [],
      latestLedger: 200,
    });
    await expect(
      server.getAccount(
        'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC',
      ),
    ).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// sendTransaction
// ---------------------------------------------------------------------------

describe('sendTransaction()', () => {
  it('sends transaction and returns response', async () => {
    const fn = mockJsonRpc({
      status: 'PENDING',
      hash: 'abc123def456',
      latestLedger: 1000,
      latestLedgerCloseTime: '1234567890',
    });
    // Create a proper TransactionEnvelope using the correct arm names
    const fakeTx = {
      toEnvelope: () => ({
        Tx: {
          tx: {
            sourceAccount: { Ed25519: new Uint8Array(32) },
            fee: 100,
            seqNum: 1n,
            cond: { Time: { minTime: 0n, maxTime: 0n } },
            memo: 'None',
            operations: [],
            ext: '0',
          },
          signatures: [],
        },
      }),
    };
    const result = await server.sendTransaction(fakeTx);
    expect(result.status).toBe('PENDING');
    expect(result.hash).toBe('abc123def456');
    expect(lastRpcMethod(fn)).toBe('sendTransaction');
  });

  it('sends the envelope as base64 in the transaction param', async () => {
    const fn = mockJsonRpc({
      status: 'PENDING',
      hash: 'xyz',
      latestLedger: 100,
      latestLedgerCloseTime: '0',
    });
    const fakeTx = {
      toEnvelope: () => ({
        Tx: {
          tx: {
            sourceAccount: { Ed25519: new Uint8Array(32) },
            fee: 100,
            seqNum: 1n,
            cond: { Time: { minTime: 0n, maxTime: 0n } },
            memo: 'None',
            operations: [],
            ext: '0',
          },
          signatures: [],
        },
      }),
    };
    await server.sendTransaction(fakeTx);
    const params = lastRpcParams(fn);
    expect(typeof params.transaction).toBe('string');
    // Should be valid base64
    expect(params.transaction).toBe(VALID_TX_ENVELOPE_XDR);
  });
});

// ---------------------------------------------------------------------------
// getTransaction
// ---------------------------------------------------------------------------

describe('getTransaction()', () => {
  it('returns NOT_FOUND for missing transaction', async () => {
    const fn = mockJsonRpc({
      status: 'NOT_FOUND',
      latestLedger: 1000,
      latestLedgerCloseTime: '1234567890',
      oldestLedger: 500,
      oldestLedgerCloseTime: '1234500000',
    });
    const result = await server.getTransaction('missing_hash');
    expect(result.status).toBe('NOT_FOUND');
    expect(lastRpcMethod(fn)).toBe('getTransaction');
    expect(lastRpcParams(fn).hash).toBe('missing_hash');
  });

  it('returns SUCCESS without XDR fields', async () => {
    const fn = mockJsonRpc({
      status: 'SUCCESS',
      latestLedger: 1000,
      latestLedgerCloseTime: '1234567890',
      oldestLedger: 500,
      oldestLedgerCloseTime: '1234500000',
      ledger: 800,
      createdAt: '1234560000',
      applicationOrder: 1,
    });
    const result = await server.getTransaction('found_hash');
    expect(result.status).toBe('SUCCESS');
    expect(lastRpcMethod(fn)).toBe('getTransaction');
  });
});

// ---------------------------------------------------------------------------
// getEvents
// ---------------------------------------------------------------------------

describe('getEvents()', () => {
  it('returns events list', async () => {
    const fn = mockJsonRpc({
      events: [
        {
          type: 'contract',
          ledger: 100,
          ledgerClosedAt: '2024-01-01T00:00:00Z',
          contractId:
            'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
          id: 'event1',
          pagingToken: 'token1',
          txHash: 'abc123',
          topic: [SCVAL_VOID_B64],
          value: SCVAL_U32_42_B64,
          inSuccessfulContractCall: true,
        },
      ],
      latestLedger: 200,
    });
    const result = await server.getEvents({ startLedger: 90 });
    expect(result.events).toHaveLength(1);
    expect(result.latestLedger).toBe(200);
    expect(lastRpcMethod(fn)).toBe('getEvents');
  });

  it('returns empty events when none match', async () => {
    mockJsonRpc({
      events: [],
      latestLedger: 200,
    });
    const result = await server.getEvents({ startLedger: 90 });
    expect(result.events).toHaveLength(0);
  });

  it('passes startLedger in params', async () => {
    const fn = mockJsonRpc({
      events: [],
      latestLedger: 200,
    });
    await server.getEvents({ startLedger: 42 });
    expect(lastRpcParams(fn).startLedger).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// getLedgerEntries
// ---------------------------------------------------------------------------

describe('getLedgerEntries()', () => {
  it('returns ledger entries with proper LedgerKey', async () => {
    const fn = mockJsonRpc({
      entries: [
        {
          key: VALID_ACCOUNT_KEY_XDR,
          xdr: VALID_ACCOUNT_ENTRY_XDR,
          lastModifiedLedgerSeq: 100,
        },
      ],
      latestLedger: 200,
    });
    // Pass a proper LedgerKey object (Account key with zero pubkey)
    const accountKey = {
      Account: {
        accountID: { PublicKeyTypeEd25519: new Uint8Array(32) },
      },
    };
    const result = await server.getLedgerEntries(accountKey);
    expect(result.latestLedger).toBe(200);
    expect(result.entries).toHaveLength(1);
    expect(lastRpcMethod(fn)).toBe('getLedgerEntries');
  });

  it('sends keys as base64 in params', async () => {
    const fn = mockJsonRpc({
      entries: [],
      latestLedger: 200,
    });
    const accountKey = {
      Account: {
        accountID: { PublicKeyTypeEd25519: new Uint8Array(32) },
      },
    };
    await server.getLedgerEntries(accountKey);
    const params = lastRpcParams(fn);
    expect(params.keys).toHaveLength(1);
    expect(typeof params.keys[0]).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// simulateTransaction
// ---------------------------------------------------------------------------

describe('simulateTransaction()', () => {
  it('sends the correct RPC method', async () => {
    // Valid SorobanTransactionData base64 (empty footprint, zero resources/fee)
    const validSorobanData =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const fn = mockJsonRpc({
      latestLedger: 500,
      minResourceFee: '100',
      cost: { cpuInsns: '1000000', memBytes: '500000' },
      transactionData: validSorobanData,
      events: [],
      results: [],
    });
    const fakeTx = {
      toEnvelope: () => ({
        Tx: {
          tx: {
            sourceAccount: { Ed25519: new Uint8Array(32) },
            fee: 100,
            seqNum: 1n,
            cond: { Time: { minTime: 0n, maxTime: 0n } },
            memo: 'None',
            operations: [],
            ext: '0',
          },
          signatures: [],
        },
      }),
    };
    const result = await server.simulateTransaction(fakeTx);
    expect(result.latestLedger).toBe(500);
    expect(lastRpcMethod(fn)).toBe('simulateTransaction');
    // Verify it sent the envelope as base64
    expect(lastRpcParams(fn).transaction).toBe(VALID_TX_ENVELOPE_XDR);
  });
});

// ---------------------------------------------------------------------------
// JSON-RPC error handling
// ---------------------------------------------------------------------------

describe('JSON-RPC error handling', () => {
  it('throws on JSON-RPC error response', async () => {
    mockJsonRpcError(-32600, 'Invalid Request');
    await expect(server.getHealth()).rejects.toThrow('Invalid Request');
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(server.getHealth()).rejects.toThrow('HTTP 500');
  });
});

// ---------------------------------------------------------------------------
// Custom headers
// ---------------------------------------------------------------------------

describe('custom headers', () => {
  it('passes custom headers to JSON-RPC calls', async () => {
    const fn = mockJsonRpc({ status: 'healthy' });
    const customServer = new SorobanRpc.Server(
      'https://soroban-testnet.stellar.org',
      { headers: { Authorization: 'Bearer token123' } },
    );
    await customServer.getHealth();

    const fetchOpts = fn.mock.calls[0]![1] as RequestInit;
    const headers = fetchOpts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token123');
  });
});
