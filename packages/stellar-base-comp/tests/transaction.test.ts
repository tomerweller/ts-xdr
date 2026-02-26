import { describe, it, expect } from 'vitest';
import { Transaction } from '../src/transaction.js';
import { TransactionBuilder } from '../src/transaction-builder.js';
import { Account } from '../src/account.js';
import { Asset } from '../src/asset.js';
import { Memo } from '../src/memo.js';
import { Operation } from '../src/operation.js';
import { Keypair } from '../src/keypair.js';
import { Networks, BASE_FEE, TimeoutInfinite } from '../src/networks.js';

const SECRET1 = 'SDL2ENWLAB7NHNVZUWTSZO23D3YLF4YUKUBHLWDVHKNDFJ37VDQ2RI53';
const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const SECRET2 = 'SAFBKRN4SQQAOIUOTLNNKJMTRHWB7XREBH2RE235X6ANUJYXA45VN4GS';
const PUBKEY2 = 'GABHZBLQHGDTFYSS7O52RQCQBL7GTURQM5WXFU2ZFXSIGBN4BEYOOOMZ';
const DEST = 'GAT4KBPBCPTOLGILH5NNTBWSXHEBUTRQMEUSQGSPCCFM4QHO2COADB5O';

function buildTestTx(opts?: {
  seq?: string;
  memo?: Memo;
  ops?: any[];
  timeout?: number;
}): Transaction {
  const account = new Account(PUBKEY1, opts?.seq ?? '100');
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
    memo: opts?.memo,
  });

  const operations = opts?.ops ?? [
    Operation.payment({
      destination: DEST,
      asset: Asset.native(),
      amount: '10',
    }),
  ];

  for (const op of operations) {
    builder.addOperation(op);
  }
  builder.setTimeout(opts?.timeout ?? 30);
  return builder.build();
}

describe('Transaction', () => {
  describe('constructor from XDR', () => {
    it('constructs from envelope XDR string', () => {
      const tx = buildTestTx();
      const xdr = tx.toXDR();
      const restored = new Transaction(xdr, Networks.TESTNET);
      expect(restored.source).toBe(PUBKEY1);
    });

    it('validates source account', () => {
      const tx = buildTestTx();
      expect(tx.source).toBe(PUBKEY1);
    });

    it('validates fee', () => {
      const tx = buildTestTx();
      expect(tx.fee).toBe('100');
    });

    it('validates sequence', () => {
      const tx = buildTestTx({ seq: '999' });
      expect(tx.sequence).toBe('1000'); // incremented
    });

    it('validates memo', () => {
      const tx = buildTestTx({ memo: Memo.text('hello') });
      expect(tx.memo.type).toBe('text');
      expect(tx.memo.value).toBe('hello');
    });

    it('validates operations count', () => {
      const tx = buildTestTx();
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('hash', () => {
    it('returns a 32-byte hash', () => {
      const tx = buildTestTx();
      expect(tx.hash()).toBeInstanceOf(Uint8Array);
      expect(tx.hash().length).toBe(32);
    });

    it('produces consistent hash', () => {
      const tx = buildTestTx();
      const hash1 = tx.hash();
      const hash2 = tx.hash();
      expect(Array.from(hash1)).toEqual(Array.from(hash2));
    });
  });

  describe('sign', () => {
    it('signs correctly', () => {
      const kp = Keypair.fromSecret(SECRET1);
      const tx = buildTestTx();
      tx.sign(kp);
      expect(tx.signatures.length).toBe(1);
      expect(tx.signatures[0].signature.length).toBe(64);
    });

    it('supports multiple signers', () => {
      const kp1 = Keypair.fromSecret(SECRET1);
      const kp2 = Keypair.fromSecret(SECRET2);
      const tx = buildTestTx();
      tx.sign(kp1, kp2);
      expect(tx.signatures.length).toBe(2);
    });

    it('appends signatures on multiple sign calls', () => {
      const kp1 = Keypair.fromSecret(SECRET1);
      const kp2 = Keypair.fromSecret(SECRET2);
      const tx = buildTestTx();
      tx.sign(kp1);
      tx.sign(kp2);
      expect(tx.signatures.length).toBe(2);
    });
  });

  describe('addSignature', () => {
    it('adds a signature from public key and base64 sig', () => {
      const kp = Keypair.fromSecret(SECRET1);
      const tx = buildTestTx();
      const sig = kp.sign(tx.hash());
      const sigBase64 = btoa(String.fromCharCode(...sig));
      tx.addSignature(PUBKEY1, sigBase64);
      expect(tx.signatures.length).toBe(1);
      expect(tx.signatures[0].hint.length).toBe(4);
    });
  });

  describe('toEnvelope', () => {
    it('returns an envelope with Tx arm', () => {
      const tx = buildTestTx();
      const env = tx.toEnvelope();
      expect('Tx' in env).toBe(true);
    });

    it('includes signatures in envelope', () => {
      const kp = Keypair.fromSecret(SECRET1);
      const tx = buildTestTx();
      tx.sign(kp);
      const env = tx.toEnvelope();
      expect(env.Tx!.signatures.length).toBe(1);
    });
  });

  describe('toXDR / fromXDR roundtrip', () => {
    it('roundtrips through XDR', () => {
      const tx = buildTestTx({ memo: Memo.id('42') });
      const xdr = tx.toXDR();
      const restored = new Transaction(xdr, Networks.TESTNET);
      expect(restored.source).toBe(tx.source);
      expect(restored.fee).toBe(tx.fee);
      expect(restored.sequence).toBe(tx.sequence);
      expect(restored.memo.type).toBe('id');
      expect(restored.memo.value).toBe('42');
    });

    it('preserves signatures through roundtrip', () => {
      const kp = Keypair.fromSecret(SECRET1);
      const tx = buildTestTx();
      tx.sign(kp);
      const xdr = tx.toXDR();
      const restored = new Transaction(xdr, Networks.TESTNET);
      expect(restored.signatures.length).toBe(1);
    });
  });

  describe('timeBounds', () => {
    it('has timeBounds when setTimeout is called', () => {
      const tx = buildTestTx({ timeout: 30 });
      expect(tx.timeBounds).not.toBeNull();
      expect(tx.timeBounds!.minTime).toBe('0');
      expect(Number(tx.timeBounds!.maxTime)).toBeGreaterThan(0);
    });

    it('has zero maxTime with infinite timeout', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '1',
        }),
      );
      builder.setTimeout(TimeoutInfinite);
      const tx = builder.build();
      expect(tx.timeBounds).not.toBeNull();
      expect(tx.timeBounds!.maxTime).toBe('0');
    });

    it('uses explicit timebounds from constructor', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
        timebounds: { minTime: 1000, maxTime: 2000 },
      });
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '1',
        }),
      );
      const tx = builder.build();
      expect(tx.timeBounds!.minTime).toBe('1000');
      expect(tx.timeBounds!.maxTime).toBe('2000');
    });
  });

  describe('multi-operation fee calculation', () => {
    it('fee = baseFee * numberOfOps', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '1',
        }),
      );
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '2',
        }),
      );
      builder.setTimeout(30);
      const tx = builder.build();
      // BASE_FEE is '100', 2 ops = 200
      expect(tx.fee).toBe('200');
    });
  });
});
