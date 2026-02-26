import { describe, it, expect } from 'vitest';
import { TransactionBuilder } from '../src/transaction-builder.js';
import { Account } from '../src/account.js';
import { Asset } from '../src/asset.js';
import { Memo } from '../src/memo.js';
import { Operation } from '../src/operation.js';
import { Keypair } from '../src/keypair.js';
import { Transaction, FeeBumpTransaction } from '../src/transaction.js';
import { Networks, BASE_FEE, TimeoutInfinite } from '../src/networks.js';

const SECRET1 = 'SDL2ENWLAB7NHNVZUWTSZO23D3YLF4YUKUBHLWDVHKNDFJ37VDQ2RI53';
const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const PUBKEY2 = 'GABHZBLQHGDTFYSS7O52RQCQBL7GTURQM5WXFU2ZFXSIGBN4BEYOOOMZ';
const DEST = 'GAT4KBPBCPTOLGILH5NNTBWSXHEBUTRQMEUSQGSPCCFM4QHO2COADB5O';

describe('TransactionBuilder', () => {
  describe('build()', () => {
    it('builds a payment transaction synchronously', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });

      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '10',
        }),
      );
      builder.setTimeout(30);

      const tx = builder.build();
      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.source).toBe(PUBKEY1);
      expect(tx.fee).toBe('100');
      expect(tx.sequence).toBe('101');
      expect(account.sequenceNumber()).toBe('101');
    });

    it('calculates fee as baseFee * numOps', () => {
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
      expect(tx.fee).toBe('200');
    });

    it('supports custom base fee', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: '500',
        networkPassphrase: Networks.TESTNET,
      });

      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '1',
        }),
      );
      builder.setTimeout(30);

      const tx = builder.build();
      expect(tx.fee).toBe('500');
    });

    it('requires at least one operation', () => {
      const account = new Account(PUBKEY1, '500');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });
      builder.setTimeout(30);
      expect(() => builder.build()).toThrow('at least one operation');
    });

    it('requires timeout or timebounds', () => {
      const account = new Account(PUBKEY1, '600');
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
      expect(() => builder.build()).toThrow('TimeBounds');
    });
  });

  describe('setTimeout()', () => {
    it('sets timeout with infinite (0)', () => {
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
      expect(tx.timeBounds!.maxTime).toBe('0');
    });

    it('sets timeout with positive value', () => {
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
      builder.setTimeout(30);
      const tx = builder.build();
      expect(Number(tx.timeBounds!.maxTime)).toBeGreaterThan(0);
    });

    it('throws on negative timeout', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });
      expect(() => builder.setTimeout(-1)).toThrow();
    });
  });

  describe('setTimebounds()', () => {
    it('sets explicit timebounds', () => {
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
      builder.setTimebounds(1000, 2000);
      const tx = builder.build();
      expect(tx.timeBounds!.minTime).toBe('1000');
      expect(tx.timeBounds!.maxTime).toBe('2000');
    });

    it('accepts string timebounds', () => {
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
      builder.setTimebounds('100', '200');
      const tx = builder.build();
      expect(tx.timeBounds!.minTime).toBe('100');
      expect(tx.timeBounds!.maxTime).toBe('200');
    });
  });

  describe('constructor timebounds', () => {
    it('sets timebounds from constructor options', () => {
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

  describe('addMemo()', () => {
    it('adds memo to transaction', () => {
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
      builder.addMemo(Memo.text('hello'));
      builder.setTimeout(30);
      const tx = builder.build();
      expect(tx.memo.type).toBe('text');
      expect(tx.memo.value).toBe('hello');
    });

    it('memo from constructor opts', () => {
      const account = new Account(PUBKEY1, '100');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
        memo: Memo.id('42'),
      });
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '1',
        }),
      );
      builder.setTimeout(30);
      const tx = builder.build();
      expect(tx.memo.type).toBe('id');
      expect(tx.memo.value).toBe('42');
    });
  });

  describe('signs and serializes', () => {
    it('signs and produces valid XDR', () => {
      const kp = Keypair.fromSecret(SECRET1);
      const account = new Account(PUBKEY1, '200');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });

      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '5',
        }),
      );
      builder.setTimeout(TimeoutInfinite);

      const tx = builder.build();
      tx.sign(kp);
      expect(tx.signatures.length).toBe(1);

      const xdr = tx.toXDR();
      expect(typeof xdr).toBe('string');
      expect(xdr.length).toBeGreaterThan(0);
    });
  });

  describe('fromXDR()', () => {
    it('parses regular transaction', () => {
      const account = new Account(PUBKEY1, '300');
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });

      builder.addOperation(
        Operation.createAccount({
          destination: DEST,
          startingBalance: '100',
        }),
      );
      builder.setTimeout(30);

      const tx = builder.build();
      const xdr = tx.toXDR();

      const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      expect(parsed).toBeInstanceOf(Transaction);
      expect((parsed as Transaction).source).toBe(PUBKEY1);
    });

    it('parses fee bump transaction', () => {
      const account = new Account(PUBKEY1, '400');
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
      builder.setTimeout(30);

      const innerTx = builder.build();
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );

      const xdr = bump.toXDR();
      const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      expect(parsed).toBeInstanceOf(FeeBumpTransaction);
    });

    it('accepts Uint8Array input', () => {
      const account = new Account(PUBKEY1, '500');
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
      builder.setTimeout(30);

      const tx = builder.build();
      const base64 = tx.toXDR();
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const parsed = TransactionBuilder.fromXDR(bytes, Networks.TESTNET);
      expect(parsed).toBeInstanceOf(Transaction);
    });
  });

  describe('buildFeeBumpTransaction()', () => {
    it('builds fee bump with correct fee source', () => {
      const innerTx = buildInnerTx('600');
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );

      expect(bump).toBeInstanceOf(FeeBumpTransaction);
      expect(bump.feeSource).toBe(PUBKEY2);
    });

    it('fee = baseFee * (innerOps + 1)', () => {
      const innerTx = buildInnerTx('700');
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );
      // 1 inner op + 1 = 2 → 200 * 2 = 400
      expect(bump.fee).toBe('400');
    });

    it('preserves inner transaction data', () => {
      const innerTx = buildInnerTx('800');
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '500',
        innerTx,
        Networks.TESTNET,
      );
      expect(bump.innerTransaction.source).toBe(PUBKEY1);
    });
  });

  describe('method chaining', () => {
    it('supports fluent API', () => {
      const account = new Account(PUBKEY1, '100');
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: DEST,
            asset: Asset.native(),
            amount: '1',
          }),
        )
        .addMemo(Memo.text('test'))
        .setTimeout(30)
        .build();

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.memo.type).toBe('text');
    });
  });
});

function buildInnerTx(seq: string) {
  const account = new Account(PUBKEY1, seq);
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  });
  builder.addOperation(
    Operation.payment({
      destination: DEST,
      asset: Asset.native(),
      amount: '10',
    }),
  );
  builder.setTimeout(30);
  return builder.build();
}
