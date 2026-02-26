/**
 * Binary compatibility tests — verifies byte-for-byte match with
 * rs-stellar-xdr test vectors.
 *
 * Test strategy:
 *   1. Decode known bytes → typed value
 *   2. Re-encode → must produce identical bytes
 *   3. Base64 roundtrip
 *   4. Spot-check decoded field values
 */
import { describe, it, expect } from 'vitest';
import {
  uint32,
  uint64,
  int64,
  varOpaque,
  fixedOpaque,
  is,
  XdrError,
  XdrErrorCode,
  encodeBase64,
} from '../../src/index.js';
import {
  TransactionEnvelope,
  Asset,
  Memo,
  Uint32,
  Hash,
  Int64,
  DecoratedSignature,
} from './stellar_types.js';
import {
  TX_SMALL_BYTES,
  TX_PAYMENT_BYTES,
  ASSET_CREDIT4_BYTES,
  MEMO_NONE_BYTES,
  MEMO_TEXT_STELLAR_BYTES,
  MEMO_ID_BYTES,
  MEMO_HASH_BYTES,
  DEFAULT_UINT32_BYTES,
  DEFAULT_HASH_BYTES,
  DEFAULT_INT64_BYTES,
  VAR_OPAQUE_5_BYTES,
  OVERSIZED_LENGTH_BYTES,
  TX_WITH_SIG_BYTES,
  TX_CHANGE_TRUST_BYTES,
  concat,
} from './fixtures.js';

// ============================================================
// Fixture 1: Minimal TransactionEnvelope (tx_small)
// ============================================================

describe('tx_small — minimal TransactionEnvelope roundtrip', () => {
  it('decodes known bytes', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_SMALL_BYTES);
    expect(is(decoded, 'tx')).toBe(true);
  });

  it('re-encodes to identical bytes', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_SMALL_BYTES);
    const reencoded = TransactionEnvelope.toXdr(decoded);
    expect(reencoded).toEqual(TX_SMALL_BYTES);
  });

  it('base64 roundtrip', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_SMALL_BYTES);
    const b64 = TransactionEnvelope.toBase64(decoded);
    expect(TransactionEnvelope.fromBase64(b64)).toEqual(decoded);
    // Also check that base64 → bytes → base64 is stable
    expect(encodeBase64(TX_SMALL_BYTES)).toBe(b64);
  });

  it('spot-checks decoded fields', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_SMALL_BYTES);
    expect(is(decoded, 'tx')).toBe(true);
    if (!is(decoded, 'tx')) return;
    const tx = decoded.tx.tx;

    // Source account: ed25519 all-zeros
    expect(is(tx.source_account, 'ed25519')).toBe(true);
    if (is(tx.source_account, 'ed25519')) {
      expect(tx.source_account.ed25519).toEqual(new Uint8Array(32));
    }

    // Fee
    expect(tx.fee).toBe(100);

    // Sequence number
    expect(tx.seq_num).toBe(1n);

    // Preconditions: none
    expect(tx.cond).toBe('none');

    // Memo: text("Stellar")
    expect(is(tx.memo, 'text')).toBe(true);
    if (is(tx.memo, 'text')) {
      expect(tx.memo.text).toBe('Stellar');
    }

    // Operations: 1 create_account
    expect(tx.operations.length).toBe(1);
    const op = tx.operations[0]!;
    expect(op.source_account).toBeNull();
    expect(is(op.body, 'create_account')).toBe(true);
    if (is(op.body, 'create_account')) {
      expect(op.body.create_account.starting_balance).toBe(10000000n);
      expect(is(op.body.create_account.destination, 'ed25519')).toBe(true);
    }

    // Extension: v0
    expect(tx.ext).toBe('v0');

    // No signatures
    expect(decoded.tx.signatures.length).toBe(0);
  });
});

// ============================================================
// Fixture 2: TransactionEnvelope with Payment op
// ============================================================

describe('tx_payment — Payment operation roundtrip', () => {
  it('decodes and re-encodes to identical bytes', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_PAYMENT_BYTES);
    expect(TransactionEnvelope.toXdr(decoded)).toEqual(TX_PAYMENT_BYTES);
  });

  it('spot-checks decoded fields', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_PAYMENT_BYTES);
    expect(is(decoded, 'tx')).toBe(true);
    if (!is(decoded, 'tx')) return;
    const tx = decoded.tx.tx;

    expect(tx.fee).toBe(200);
    expect(tx.seq_num).toBe(5n);

    // TimeBounds
    expect(is(tx.cond, 'time')).toBe(true);
    if (is(tx.cond, 'time')) {
      expect(tx.cond.time.min_time).toBe(0n);
      expect(tx.cond.time.max_time).toBe(1000n);
    }

    // Memo
    expect(is(tx.memo, 'text')).toBe(true);
    if (is(tx.memo, 'text')) {
      expect(tx.memo.text).toBe('Stellar');
    }

    // Payment op
    const op = tx.operations[0]!;
    expect(is(op.body, 'payment')).toBe(true);
    if (is(op.body, 'payment')) {
      expect(op.body.payment.asset).toBe('native');
      expect(op.body.payment.amount).toBe(50000000n);
    }

    // Source account key
    expect(is(tx.source_account, 'ed25519')).toBe(true);
    if (is(tx.source_account, 'ed25519')) {
      expect(tx.source_account.ed25519[0]).toBe(0x3c);
      expect(tx.source_account.ed25519[1]).toBe(0xb3);
    }

    // Destination key
    if (is(op.body, 'payment')) {
      expect(is(op.body.payment.destination, 'ed25519')).toBe(true);
      if (is(op.body.payment.destination, 'ed25519')) {
        expect(op.body.payment.destination.ed25519[0]).toBe(0xaa);
        expect(op.body.payment.destination.ed25519[1]).toBe(0xbb);
      }
    }
  });
});

// ============================================================
// Fixture 3: Asset::CreditAlphanum4
// ============================================================

describe('Asset roundtrip', () => {
  it('decodes credit_alphanum4', () => {
    const decoded = Asset.fromXdr(ASSET_CREDIT4_BYTES);
    expect(is(decoded, 'credit_alphanum4')).toBe(true);
    if (is(decoded, 'credit_alphanum4')) {
      expect(decoded.credit_alphanum4.asset_code).toEqual(
        new Uint8Array([85, 83, 68, 67]),
      ); // "USDC"
      expect(is(decoded.credit_alphanum4.issuer, 'ed25519')).toBe(true);
    }
  });

  it('re-encodes to identical bytes', () => {
    const decoded = Asset.fromXdr(ASSET_CREDIT4_BYTES);
    expect(Asset.toXdr(decoded)).toEqual(ASSET_CREDIT4_BYTES);
  });

  it('native encodes to 4 zero bytes', () => {
    const native: Asset = 'native';
    expect(Asset.toXdr(native)).toEqual(new Uint8Array([0, 0, 0, 0]));
  });
});

// ============================================================
// Fixture 4: Memo variants
// ============================================================

describe('Memo variants', () => {
  it('roundtrips Memo::none', () => {
    const decoded = Memo.fromXdr(MEMO_NONE_BYTES);
    expect(decoded).toBe('none');
    expect(Memo.toXdr(decoded)).toEqual(MEMO_NONE_BYTES);
  });

  it('roundtrips Memo::text("Stellar")', () => {
    const decoded = Memo.fromXdr(MEMO_TEXT_STELLAR_BYTES);
    expect(is(decoded, 'text')).toBe(true);
    if (is(decoded, 'text')) {
      expect(decoded.text).toBe('Stellar');
    }
    expect(Memo.toXdr(decoded)).toEqual(MEMO_TEXT_STELLAR_BYTES);
  });

  it('roundtrips Memo::id(42)', () => {
    const decoded = Memo.fromXdr(MEMO_ID_BYTES);
    expect(is(decoded, 'id')).toBe(true);
    if (is(decoded, 'id')) {
      expect(decoded.id).toBe(42n);
    }
    expect(Memo.toXdr(decoded)).toEqual(MEMO_ID_BYTES);
  });

  it('roundtrips Memo::hash', () => {
    const decoded = Memo.fromXdr(MEMO_HASH_BYTES);
    expect(is(decoded, 'hash')).toBe(true);
    if (is(decoded, 'hash')) {
      expect(decoded.hash).toEqual(new Uint8Array(32));
    }
    expect(Memo.toXdr(decoded)).toEqual(MEMO_HASH_BYTES);
  });
});

// ============================================================
// Fixture 5: Default/zero values (default.rs)
// ============================================================

describe('default/zero values', () => {
  it('default Uint32 is 0', () => {
    expect(Uint32.fromXdr(DEFAULT_UINT32_BYTES)).toBe(0);
  });

  it('default Hash is 32 zero bytes', () => {
    expect(Hash.fromXdr(DEFAULT_HASH_BYTES)).toEqual(new Uint8Array(32));
  });

  it('default Int64 is 0n', () => {
    expect(Int64.fromXdr(DEFAULT_INT64_BYTES)).toBe(0n);
  });
});

// ============================================================
// Fixture 6: Variable-length container edge cases (vecm.rs)
// ============================================================

describe('variable-length container edge cases', () => {
  it('decodes var opaque with length 5', () => {
    const codec = varOpaque(100);
    const decoded = codec.fromXdr(VAR_OPAQUE_5_BYTES);
    expect(decoded).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(codec.toXdr(decoded)).toEqual(VAR_OPAQUE_5_BYTES);
  });

  it('rejects oversized length prefix for bounded varOpaque', () => {
    // 0xFFFFFFFF = 4294967295 exceeds any reasonable max
    const codec = varOpaque(100);
    expect(() => codec.fromXdr(OVERSIZED_LENGTH_BYTES)).toThrow(
      XdrErrorCode.LengthExceedsMax,
    );
  });

  it('rejects oversized length prefix for unbounded varOpaque (buffer underflow)', () => {
    // Even unbounded, the buffer doesn't contain 4294967295 bytes
    const codec = varOpaque();
    expect(() => codec.fromXdr(OVERSIZED_LENGTH_BYTES)).toThrow(
      XdrErrorCode.BufferUnderflow,
    );
  });
});

// ============================================================
// Edge cases from tx_read_edge_cases.rs
// ============================================================

describe('buffer residual / underflow edge cases', () => {
  it('two uint32s concatenated: fails as single uint32', () => {
    const twoU32s = concat(uint32.toXdr(1), uint32.toXdr(2));
    expect(() => uint32.fromXdr(twoU32s)).toThrow(
      XdrErrorCode.BufferNotFullyConsumed,
    );
  });

  it('two uint32s concatenated: succeeds as uint64', () => {
    const twoU32s = concat(uint32.toXdr(1), uint32.toXdr(2));
    // Big-endian: 0x00000001_00000002 = (1 << 32) | 2
    expect(uint64.fromXdr(twoU32s)).toBe((1n << 32n) | 2n);
  });

  it('empty buffer fails for any primitive', () => {
    const empty = new Uint8Array(0);
    expect(() => uint32.fromXdr(empty)).toThrow(XdrErrorCode.BufferUnderflow);
    expect(() => int64.fromXdr(empty)).toThrow(XdrErrorCode.BufferUnderflow);
  });

  it('truncated buffer fails for TransactionEnvelope', () => {
    // Just the envelope discriminant, nothing else
    expect(() =>
      TransactionEnvelope.fromXdr(new Uint8Array([0, 0, 0, 2])),
    ).toThrow(XdrErrorCode.BufferUnderflow);
  });

  it('extra trailing bytes rejected for fixed-size types', () => {
    // uint32 with extra byte
    expect(() =>
      uint32.fromXdr(new Uint8Array([0, 0, 0, 1, 0xff])),
    ).toThrow(XdrErrorCode.BufferNotFullyConsumed);

    // fixedOpaque(4) with extra bytes
    const opaque4 = fixedOpaque(4);
    expect(() =>
      opaque4.fromXdr(new Uint8Array([1, 2, 3, 4, 0xff])),
    ).toThrow(XdrErrorCode.BufferNotFullyConsumed);
  });
});

// ============================================================
// Fixture 7: Transaction with signature
// ============================================================

describe('TransactionEnvelope with signature', () => {
  it('decodes and re-encodes', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_WITH_SIG_BYTES);
    expect(TransactionEnvelope.toXdr(decoded)).toEqual(TX_WITH_SIG_BYTES);
  });

  it('spot-checks signature fields', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_WITH_SIG_BYTES);
    expect(is(decoded, 'tx')).toBe(true);
    if (!is(decoded, 'tx')) return;
    const sigs = decoded.tx.signatures;

    expect(sigs.length).toBe(1);
    expect(sigs[0]!.hint).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    expect(sigs[0]!.signature.length).toBe(64);
    expect(sigs[0]!.signature[0]).toBe(0xab);
  });
});

// ============================================================
// Fixture 8: ChangeTrust operation
// ============================================================

describe('ChangeTrust operation roundtrip', () => {
  it('decodes and re-encodes', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_CHANGE_TRUST_BYTES);
    expect(TransactionEnvelope.toXdr(decoded)).toEqual(TX_CHANGE_TRUST_BYTES);
  });

  it('spot-checks decoded fields', () => {
    const decoded = TransactionEnvelope.fromXdr(TX_CHANGE_TRUST_BYTES);
    expect(is(decoded, 'tx')).toBe(true);
    if (!is(decoded, 'tx')) return;
    const tx = decoded.tx.tx;

    expect(tx.fee).toBe(100);
    expect(tx.seq_num).toBe(3n);
    expect(tx.memo).toBe('none');

    const op = tx.operations[0]!;
    expect(is(op.body, 'change_trust')).toBe(true);
    if (is(op.body, 'change_trust')) {
      expect(is(op.body.change_trust.line, 'credit_alphanum4')).toBe(true);
      if (is(op.body.change_trust.line, 'credit_alphanum4')) {
        expect(op.body.change_trust.line.credit_alphanum4.asset_code).toEqual(
          new Uint8Array([85, 83, 68, 67]),
        ); // "USDC"
      }

      // limit = INT64_MAX
      expect(op.body.change_trust.limit).toBe(9223372036854775807n);
    }
  });
});

// ============================================================
// Cross-format: base64 ↔ binary consistency
// ============================================================

describe('base64 ↔ binary consistency', () => {
  const fixtures = [
    { name: 'TX_SMALL', bytes: TX_SMALL_BYTES },
    { name: 'TX_PAYMENT', bytes: TX_PAYMENT_BYTES },
    { name: 'TX_WITH_SIG', bytes: TX_WITH_SIG_BYTES },
    { name: 'TX_CHANGE_TRUST', bytes: TX_CHANGE_TRUST_BYTES },
  ];

  for (const { name, bytes } of fixtures) {
    it(`${name}: fromBase64(toBase64(bytes)) roundtrips`, () => {
      const decoded = TransactionEnvelope.fromXdr(bytes);
      const b64 = TransactionEnvelope.toBase64(decoded);
      const fromB64 = TransactionEnvelope.fromBase64(b64);
      expect(TransactionEnvelope.toXdr(fromB64)).toEqual(bytes);
    });
  }
});
