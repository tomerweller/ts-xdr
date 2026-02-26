import { describe, it, expect } from 'vitest';
import { FeeBumpTransaction } from '../src/transaction.js';
import { TransactionBuilder } from '../src/transaction-builder.js';
import { Account } from '../src/account.js';
import { Asset } from '../src/asset.js';
import { Operation } from '../src/operation.js';
import { Keypair } from '../src/keypair.js';
import { Networks, BASE_FEE } from '../src/networks.js';

const SECRET1 = 'SDL2ENWLAB7NHNVZUWTSZO23D3YLF4YUKUBHLWDVHKNDFJ37VDQ2RI53';
const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const SECRET2 = 'SAFBKRN4SQQAOIUOTLNNKJMTRHWB7XREBH2RE235X6ANUJYXA45VN4GS';
const PUBKEY2 = 'GABHZBLQHGDTFYSS7O52RQCQBL7GTURQM5WXFU2ZFXSIGBN4BEYOOOMZ';
const DEST = 'GAT4KBPBCPTOLGILH5NNTBWSXHEBUTRQMEUSQGSPCCFM4QHO2COADB5O';

function buildInnerTx(seq = '100'): ReturnType<TransactionBuilder['build']> {
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

describe('FeeBumpTransaction', () => {
  describe('construction', () => {
    it('constructs from inner transaction', () => {
      const innerTx = buildInnerTx();
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );
      expect(bump).toBeInstanceOf(FeeBumpTransaction);
      expect(bump.feeSource).toBe(PUBKEY2);
    });

    it('calculates fee as baseFee * (innerOps + 1)', () => {
      const innerTx = buildInnerTx();
      // 1 inner op, fee = 200 * (1 + 1) = 400
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );
      expect(bump.fee).toBe('400');
    });

    it('preserves inner transaction', () => {
      const innerTx = buildInnerTx();
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );
      expect(bump.innerTransaction.source).toBe(PUBKEY1);
      expect(bump.innerTransaction.operations.length).toBe(1);
    });
  });

  describe('hash', () => {
    it('returns a 32-byte hash', () => {
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      expect(bump.hash()).toBeInstanceOf(Uint8Array);
      expect(bump.hash().length).toBe(32);
    });

    it('produces different hash from inner transaction', () => {
      const innerTx = buildInnerTx();
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        innerTx,
        Networks.TESTNET,
      );
      expect(Array.from(bump.hash())).not.toEqual(
        Array.from(innerTx.hash()),
      );
    });
  });

  describe('signing', () => {
    it('signs fee bump transaction', () => {
      const kp = Keypair.fromSecret(SECRET2);
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      bump.sign(kp);
      expect(bump.signatures.length).toBe(1);
      expect(bump.signatures[0].signature.length).toBe(64);
    });

    it('supports multiple signers', () => {
      const kp1 = Keypair.fromSecret(SECRET1);
      const kp2 = Keypair.fromSecret(SECRET2);
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      bump.sign(kp1, kp2);
      expect(bump.signatures.length).toBe(2);
    });
  });

  describe('toXDR / fromXDR roundtrip', () => {
    it('roundtrips through XDR', () => {
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      const xdr = bump.toXDR();
      const restored = new FeeBumpTransaction(xdr, Networks.TESTNET);
      expect(restored.feeSource).toBe(bump.feeSource);
      expect(restored.fee).toBe(bump.fee);
    });

    it('preserves signatures through roundtrip', () => {
      const kp = Keypair.fromSecret(SECRET2);
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      bump.sign(kp);
      const xdr = bump.toXDR();
      const restored = new FeeBumpTransaction(xdr, Networks.TESTNET);
      expect(restored.signatures.length).toBe(1);
    });

    it('fromXDR detects fee bump transactions', () => {
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      const xdr = bump.toXDR();
      const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      expect(parsed).toBeInstanceOf(FeeBumpTransaction);
    });
  });

  describe('toEnvelope', () => {
    it('returns an envelope with TxFeeBump arm', () => {
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        PUBKEY2,
        '200',
        buildInnerTx(),
        Networks.TESTNET,
      );
      const env = bump.toEnvelope();
      expect('TxFeeBump' in env).toBe(true);
    });
  });
});
