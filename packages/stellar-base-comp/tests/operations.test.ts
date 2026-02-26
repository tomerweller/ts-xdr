import { describe, it, expect } from 'vitest';
import { Operation } from '../src/operation.js';
import { Asset } from '../src/asset.js';
import { TransactionBuilder } from '../src/transaction-builder.js';
import { Account } from '../src/account.js';
import { Keypair } from '../src/keypair.js';
import { Transaction } from '../src/transaction.js';
import { Claimant } from '../src/claimant.js';
import { Networks, BASE_FEE } from '../src/networks.js';

const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const PUBKEY2 = 'GABHZBLQHGDTFYSS7O52RQCQBL7GTURQM5WXFU2ZFXSIGBN4BEYOOOMZ';
const DEST = 'GAT4KBPBCPTOLGILH5NNTBWSXHEBUTRQMEUSQGSPCCFM4QHO2COADB5O';
const ISSUER = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';

let seq = 0;

function buildTxWithOp(op: any): Transaction {
  seq++;
  const account = new Account(PUBKEY1, String(seq * 1000));
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  });
  builder.addOperation(op);
  builder.setTimeout(30);
  return builder.build();
}

function roundtrip(op: any): Transaction {
  const tx = buildTxWithOp(op);
  const xdr = tx.toXDR();
  return TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
}

describe('Operations', () => {
  describe('createAccount', () => {
    it('creates valid operation', () => {
      const op = Operation.createAccount({
        destination: DEST,
        startingBalance: '100',
      });
      expect(op).toBeDefined();
    });

    it('roundtrips through XDR', () => {
      const op = Operation.createAccount({
        destination: DEST,
        startingBalance: '100.5',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.createAccount({
        destination: DEST,
        startingBalance: '50',
        source: PUBKEY2,
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('payment', () => {
    it('creates native payment', () => {
      const op = Operation.payment({
        destination: DEST,
        asset: Asset.native(),
        amount: '10',
      });
      expect(op).toBeDefined();
    });

    it('creates credit payment', () => {
      const op = Operation.payment({
        destination: DEST,
        asset: new Asset('USD', ISSUER),
        amount: '50.5',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.payment({
        destination: DEST,
        asset: Asset.native(),
        amount: '1',
        source: PUBKEY2,
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('pathPaymentStrictReceive', () => {
    it('creates valid operation', () => {
      const op = Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: '10',
        destination: DEST,
        destAsset: new Asset('USD', ISSUER),
        destAmount: '5',
        path: [],
      });
      expect(op).toBeDefined();
    });

    it('roundtrips with path', () => {
      const op = Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: '20',
        destination: DEST,
        destAsset: new Asset('EUR', ISSUER),
        destAmount: '10',
        path: [new Asset('USD', ISSUER)],
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('pathPaymentStrictSend', () => {
    it('creates valid operation', () => {
      const op = Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '10',
        destination: DEST,
        destAsset: new Asset('USD', ISSUER),
        destMin: '5',
        path: [],
      });
      expect(op).toBeDefined();
    });

    it('roundtrips', () => {
      const op = Operation.pathPaymentStrictSend({
        sendAsset: new Asset('USD', ISSUER),
        sendAmount: '15',
        destination: DEST,
        destAsset: Asset.native(),
        destMin: '10',
        path: [new Asset('EUR', ISSUER)],
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('manageSellOffer', () => {
    it('creates with string price', () => {
      const op = Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '100',
        price: '3.75',
      });
      expect(op).toBeDefined();
    });

    it('creates with fraction price', () => {
      const op = Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '50',
        price: { n: 1, d: 4 },
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with integer price', () => {
      const op = Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '100',
        price: '2',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with offerId for update', () => {
      const op = Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '100',
        price: '1',
        offerId: '12345',
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates delete offer (amount = 0)', () => {
      const op = Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '0',
        price: '1',
        offerId: '12345',
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('manageBuyOffer', () => {
    it('creates valid operation', () => {
      const op = Operation.manageBuyOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        buyAmount: '100',
        price: '3',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with fraction price', () => {
      const op = Operation.manageBuyOffer({
        selling: new Asset('EUR', ISSUER),
        buying: new Asset('USD', ISSUER),
        buyAmount: '50',
        price: { n: 3, d: 4 },
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('createPassiveSellOffer', () => {
    it('creates valid operation', () => {
      const op = Operation.createPassiveSellOffer({
        selling: Asset.native(),
        buying: new Asset('USD', ISSUER),
        amount: '100',
        price: '3.75',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with integer price', () => {
      const op = Operation.createPassiveSellOffer({
        selling: new Asset('EUR', ISSUER),
        buying: Asset.native(),
        amount: '50',
        price: '5',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('setOptions', () => {
    it('creates with inflationDest', () => {
      const op = Operation.setOptions({
        inflationDest: DEST,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with thresholds', () => {
      const op = Operation.setOptions({
        masterWeight: 1,
        lowThreshold: 1,
        medThreshold: 2,
        highThreshold: 3,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with homeDomain', () => {
      const op = Operation.setOptions({
        homeDomain: 'example.com',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with flags', () => {
      const op = Operation.setOptions({
        setFlags: 1,
        clearFlags: 2,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with no options (all empty)', () => {
      const op = Operation.setOptions({});
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('changeTrust', () => {
    it('creates valid operation', () => {
      const op = Operation.changeTrust({
        asset: new Asset('USD', ISSUER),
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with custom limit', () => {
      const op = Operation.changeTrust({
        asset: new Asset('USD', ISSUER),
        limit: '1000',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('allowTrust', () => {
    it('creates valid operation', () => {
      const op = Operation.allowTrust({
        trustor: DEST,
        assetCode: 'USD',
        authorize: 1,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with authorize=0 (revoke)', () => {
      const op = Operation.allowTrust({
        trustor: DEST,
        assetCode: 'USD',
        authorize: 0,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('accountMerge', () => {
    it('creates valid operation', () => {
      const op = Operation.accountMerge({ destination: DEST });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.accountMerge({
        destination: DEST,
        source: PUBKEY2,
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('inflation', () => {
    it('creates valid operation', () => {
      const op = Operation.inflation();
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.inflation({ source: PUBKEY2 });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('manageData', () => {
    it('creates with string value', () => {
      const op = Operation.manageData({
        name: 'testKey',
        value: 'testValue',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with Uint8Array value', () => {
      const op = Operation.manageData({
        name: 'binKey',
        value: new Uint8Array([1, 2, 3, 4]),
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates delete (null value)', () => {
      const op = Operation.manageData({
        name: 'deleteKey',
        value: null,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('bumpSequence', () => {
    it('creates valid operation', () => {
      const op = Operation.bumpSequence({ bumpTo: '1000' });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with large sequence number', () => {
      const op = Operation.bumpSequence({
        bumpTo: '9223372036854775807',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('createClaimableBalance', () => {
    it('creates with unconditional claimant', () => {
      const op = Operation.createClaimableBalance({
        asset: Asset.native(),
        amount: '100',
        claimants: [new Claimant(DEST)],
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with multiple claimants', () => {
      const op = Operation.createClaimableBalance({
        asset: new Asset('USD', ISSUER),
        amount: '50',
        claimants: [new Claimant(DEST), new Claimant(PUBKEY2)],
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('claimClaimableBalance', () => {
    it('creates valid operation', () => {
      const balanceId =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const op = Operation.claimClaimableBalance({ balanceId });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('beginSponsoringFutureReserves', () => {
    it('creates valid operation', () => {
      const op = Operation.beginSponsoringFutureReserves({
        sponsoredId: DEST,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('endSponsoringFutureReserves', () => {
    it('creates valid operation', () => {
      const op = Operation.endSponsoringFutureReserves();
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.endSponsoringFutureReserves({ source: PUBKEY2 });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('clawback', () => {
    it('creates valid operation', () => {
      const op = Operation.clawback({
        asset: new Asset('USD', ISSUER),
        from: DEST,
        amount: '100',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('clawbackClaimableBalance', () => {
    it('creates valid operation', () => {
      const balanceId =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const op = Operation.clawbackClaimableBalance({ balanceId });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('setTrustLineFlags', () => {
    it('creates valid operation', () => {
      const op = Operation.setTrustLineFlags({
        trustor: DEST,
        asset: new Asset('USD', ISSUER),
        clearFlags: 0,
        setFlags: 1,
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('liquidityPoolDeposit', () => {
    it('creates valid operation', () => {
      const poolId =
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const op = Operation.liquidityPoolDeposit({
        liquidityPoolId: poolId,
        maxAmountA: '100',
        maxAmountB: '200',
        minPrice: '0.5',
        maxPrice: '2',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('creates with fraction prices', () => {
      const poolId =
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const op = Operation.liquidityPoolDeposit({
        liquidityPoolId: poolId,
        maxAmountA: '50',
        maxAmountB: '100',
        minPrice: { n: 1, d: 4 },
        maxPrice: { n: 4, d: 1 },
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('liquidityPoolWithdraw', () => {
    it('creates valid operation', () => {
      const poolId =
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const op = Operation.liquidityPoolWithdraw({
        liquidityPoolId: poolId,
        amount: '50',
        minAmountA: '10',
        minAmountB: '20',
      });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('extendFootprintTtl', () => {
    it('creates valid operation', () => {
      const op = Operation.extendFootprintTtl({ extendTo: 1000 });
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.extendFootprintTtl({
        extendTo: 500,
        source: PUBKEY2,
      });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('restoreFootprint', () => {
    it('creates valid operation', () => {
      const op = Operation.restoreFootprint();
      const tx = roundtrip(op);
      expect(tx.operations.length).toBe(1);
    });

    it('accepts source account', () => {
      const op = Operation.restoreFootprint({ source: PUBKEY2 });
      const tx = buildTxWithOp(op);
      expect(tx.operations.length).toBe(1);
    });
  });

  describe('amount utilities', () => {
    it('toStroops converts correctly', () => {
      expect(Operation.toStroops('1')).toBe('10000000');
      expect(Operation.toStroops('0.5')).toBe('5000000');
      expect(Operation.toStroops('100.123')).toBe('1001230000');
    });

    it('fromStroops converts correctly', () => {
      expect(Operation.fromStroops('10000000')).toBe('1');
      expect(Operation.fromStroops('5000000')).toBe('0.5');
      expect(Operation.fromStroops('1001230000')).toBe('100.123');
    });
  });

  describe('multi-operation transactions', () => {
    it('builds transaction with multiple different operations', () => {
      seq++;
      const account = new Account(PUBKEY1, String(seq * 1000));
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
      builder.addOperation(
        Operation.payment({
          destination: DEST,
          asset: Asset.native(),
          amount: '10',
        }),
      );
      builder.addOperation(
        Operation.manageData({
          name: 'test',
          value: 'data',
        }),
      );
      builder.setTimeout(30);

      const tx = builder.build();
      expect(tx.operations.length).toBe(3);
      // Fee = 100 * 3 = 300
      expect(tx.fee).toBe('300');

      // Roundtrip
      const xdr = tx.toXDR();
      const restored = TransactionBuilder.fromXDR(
        xdr,
        Networks.TESTNET,
      ) as Transaction;
      expect(restored.operations.length).toBe(3);
    });
  });
});
