/**
 * Operation class compatible with js-stellar-base.
 * Static factories that accept string amounts and return compat xdr.Operation instances.
 * Also exports a merged namespace with decoded operation interfaces (Operation.Payment, etc.).
 */

import {
  createAccount as modernCreateAccount,
  payment as modernPayment,
  pathPaymentStrictReceive as modernPathPaymentStrictReceive,
  pathPaymentStrictSend as modernPathPaymentStrictSend,
  manageSellOffer as modernManageSellOffer,
  manageBuyOffer as modernManageBuyOffer,
  createPassiveSellOffer as modernCreatePassiveSellOffer,
  setOptions as modernSetOptions,
  changeTrust as modernChangeTrust,
  allowTrust as modernAllowTrust,
  accountMerge as modernAccountMerge,
  inflation as modernInflation,
  manageData as modernManageData,
  bumpSequence as modernBumpSequence,
  createClaimableBalance as modernCreateClaimableBalance,
  claimClaimableBalance as modernClaimClaimableBalance,
  beginSponsoringFutureReserves as modernBeginSponsoringFutureReserves,
  endSponsoringFutureReserves as modernEndSponsoringFutureReserves,
  clawback as modernClawback,
  clawbackClaimableBalance as modernClawbackClaimableBalance,
  setTrustLineFlags as modernSetTrustLineFlags,
  liquidityPoolDeposit as modernLiquidityPoolDeposit,
  liquidityPoolWithdraw as modernLiquidityPoolWithdraw,
  invokeHostFunction as modernInvokeHostFunction,
  extendFootprintTtl as modernExtendFootprintTtl,
  restoreFootprint as modernRestoreFootprint,
} from '@stellar/tx-builder';
import {
  Operation as CompatOperationXdr,
} from './generated/stellar_compat.js';
import {
  is,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_MUXED_ED25519,
  type Operation as ModernOperation,
  type MuxedAccount,
} from '@stellar/xdr';
import { Asset } from './asset.js';
import { amountToBigInt, toStroops, fromStroops } from './amount.js';

function wrap(modernOp: any): any {
  return (CompatOperationXdr as any)._fromModern(modernOp);
}

function priceObj(price: string | { n: number; d: number }): { n: number; d: number } {
  if (typeof price === 'string') {
    return approximatePrice(price);
  }
  return price;
}

function approximatePrice(price: string): { n: number; d: number } {
  const parts = price.split('/');
  if (parts.length === 2) {
    return { n: parseInt(parts[0]!, 10), d: parseInt(parts[1]!, 10) };
  }
  // Simple fraction approximation
  const val = parseFloat(price);
  if (Number.isInteger(val)) {
    return { n: val, d: 1 };
  }
  // Use continued fraction approximation
  const maxDenom = 10000000;
  let bestN = 0, bestD = 1;
  let minErr = Math.abs(val);
  for (let d = 1; d <= maxDenom; d++) {
    const n = Math.round(val * d);
    const err = Math.abs(n / d - val);
    if (err < minErr) {
      minErr = err;
      bestN = n;
      bestD = d;
      if (err === 0) break;
    }
  }
  return { n: bestN, d: bestD };
}

interface OperationOpts {
  source?: string;
}

// ---------------------------------------------------------------------------
// Helper: decode MuxedAccount to string address
// ---------------------------------------------------------------------------

function muxedAccountToAddress(muxed: MuxedAccount): string {
  if (is(muxed, 'Ed25519')) {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, muxed.Ed25519);
  }
  if (is(muxed, 'MuxedEd25519')) {
    const payload = new Uint8Array(40);
    payload.set(muxed.MuxedEd25519.ed25519, 0);
    const view = new DataView(payload.buffer);
    view.setBigUint64(32, muxed.MuxedEd25519.id, false);
    return encodeStrkey(STRKEY_MUXED_ED25519, payload);
  }
  throw new Error('Unknown muxed account type');
}

function accountIdToAddress(accountId: any): string {
  if (is(accountId, 'PublicKeyTypeEd25519')) {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, accountId.PublicKeyTypeEd25519);
  }
  throw new Error('Unknown account ID type');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Operation.fromXDRObject — decode modern XDR operation to flat compat object
// ---------------------------------------------------------------------------

function decodeOperation(op: ModernOperation): any {
  const body = op.body;
  const source = op.sourceAccount ? muxedAccountToAddress(op.sourceAccount) : undefined;

  // Void arms
  if (body === 'Inflation') {
    return { type: 'inflation', source };
  }
  if (body === 'EndSponsoringFutureReserves') {
    return { type: 'endSponsoringFutureReserves', source };
  }

  // Value arms
  if (is(body, 'CreateAccount')) {
    const op_ = body.CreateAccount;
    return {
      type: 'createAccount',
      destination: accountIdToAddress(op_.destination),
      startingBalance: fromStroops(op_.startingBalance.toString()),
      source,
    };
  }

  if (is(body, 'Payment')) {
    const op_ = body.Payment;
    return {
      type: 'payment',
      destination: muxedAccountToAddress(op_.destination),
      asset: Asset._fromModern(op_.asset),
      amount: fromStroops(op_.amount.toString()),
      source,
    };
  }

  if (is(body, 'PathPaymentStrictReceive')) {
    const op_ = body.PathPaymentStrictReceive;
    return {
      type: 'pathPaymentStrictReceive',
      sendAsset: Asset._fromModern(op_.sendAsset),
      sendMax: fromStroops(op_.sendMax.toString()),
      destination: muxedAccountToAddress(op_.destination),
      destAsset: Asset._fromModern(op_.destAsset),
      destAmount: fromStroops(op_.destAmount.toString()),
      path: op_.path.map((a: any) => Asset._fromModern(a)),
      source,
    };
  }

  if (is(body, 'PathPaymentStrictSend')) {
    const op_ = body.PathPaymentStrictSend;
    return {
      type: 'pathPaymentStrictSend',
      sendAsset: Asset._fromModern(op_.sendAsset),
      sendAmount: fromStroops(op_.sendAmount.toString()),
      destination: muxedAccountToAddress(op_.destination),
      destAsset: Asset._fromModern(op_.destAsset),
      destMin: fromStroops(op_.destMin.toString()),
      path: op_.path.map((a: any) => Asset._fromModern(a)),
      source,
    };
  }

  if (is(body, 'ManageSellOffer')) {
    const op_ = body.ManageSellOffer;
    return {
      type: 'manageSellOffer',
      selling: Asset._fromModern(op_.selling),
      buying: Asset._fromModern(op_.buying),
      amount: fromStroops(op_.amount.toString()),
      price: `${op_.price.n}/${op_.price.d}`,
      offerId: op_.offerID.toString(),
      source,
    };
  }

  if (is(body, 'ManageBuyOffer')) {
    const op_ = body.ManageBuyOffer;
    return {
      type: 'manageBuyOffer',
      selling: Asset._fromModern(op_.selling),
      buying: Asset._fromModern(op_.buying),
      buyAmount: fromStroops(op_.buyAmount.toString()),
      price: `${op_.price.n}/${op_.price.d}`,
      offerId: op_.offerID.toString(),
      source,
    };
  }

  if (is(body, 'CreatePassiveSellOffer')) {
    const op_ = body.CreatePassiveSellOffer;
    return {
      type: 'createPassiveSellOffer',
      selling: Asset._fromModern(op_.selling),
      buying: Asset._fromModern(op_.buying),
      amount: fromStroops(op_.amount.toString()),
      price: `${op_.price.n}/${op_.price.d}`,
      source,
    };
  }

  if (is(body, 'SetOptions')) {
    const op_ = body.SetOptions;
    const result: any = { type: 'setOptions', source };
    if (op_.inflationDest !== null) result.inflationDest = accountIdToAddress(op_.inflationDest);
    if (op_.clearFlags !== null) result.clearFlags = op_.clearFlags;
    if (op_.setFlags !== null) result.setFlags = op_.setFlags;
    if (op_.masterWeight !== null) result.masterWeight = op_.masterWeight;
    if (op_.lowThreshold !== null) result.lowThreshold = op_.lowThreshold;
    if (op_.medThreshold !== null) result.medThreshold = op_.medThreshold;
    if (op_.highThreshold !== null) result.highThreshold = op_.highThreshold;
    if (op_.homeDomain !== null) result.homeDomain = op_.homeDomain;
    if (op_.signer !== null) result.signer = op_.signer;
    return result;
  }

  if (is(body, 'ChangeTrust')) {
    const op_ = body.ChangeTrust;
    return {
      type: 'changeTrust',
      line: Asset._fromModern(op_.line as any),
      limit: fromStroops(op_.limit.toString()),
      source,
    };
  }

  if (is(body, 'AllowTrust')) {
    const op_ = body.AllowTrust;
    const rawAsset = op_.asset;
    let assetCode: string;
    if (is(rawAsset, 'CreditAlphanum4')) {
      assetCode = new TextDecoder().decode(rawAsset.CreditAlphanum4).replace(/\0+$/, '');
    } else if (is(rawAsset, 'CreditAlphanum12')) {
      assetCode = new TextDecoder().decode(rawAsset.CreditAlphanum12).replace(/\0+$/, '');
    } else {
      assetCode = String(rawAsset);
    }
    return {
      type: 'allowTrust',
      trustor: accountIdToAddress(op_.trustor),
      assetCode,
      authorize: op_.authorize,
      source,
    };
  }

  if (is(body, 'AccountMerge')) {
    return {
      type: 'accountMerge',
      destination: muxedAccountToAddress(body.AccountMerge),
      source,
    };
  }

  if (is(body, 'ManageData')) {
    const op_ = body.ManageData;
    return {
      type: 'manageData',
      name: op_.dataName,
      value: op_.dataValue,
      source,
    };
  }

  if (is(body, 'BumpSequence')) {
    const op_ = body.BumpSequence;
    return {
      type: 'bumpSequence',
      bumpTo: op_.bumpTo.toString(),
      source,
    };
  }

  if (is(body, 'CreateClaimableBalance')) {
    const op_ = body.CreateClaimableBalance;
    return {
      type: 'createClaimableBalance',
      asset: Asset._fromModern(op_.asset),
      amount: fromStroops(op_.amount.toString()),
      claimants: op_.claimants,
      source,
    };
  }

  if (is(body, 'ClaimClaimableBalance')) {
    const op_ = body.ClaimClaimableBalance;
    return {
      type: 'claimClaimableBalance',
      balanceId: op_.balanceID,
      source,
    };
  }

  if (is(body, 'BeginSponsoringFutureReserves')) {
    const op_ = body.BeginSponsoringFutureReserves;
    return {
      type: 'beginSponsoringFutureReserves',
      sponsoredId: accountIdToAddress(op_.sponsoredID),
      source,
    };
  }

  if (is(body, 'RevokeSponsorship')) {
    return {
      type: 'revokeSponsorship',
      ...body.RevokeSponsorship,
      source,
    };
  }

  if (is(body, 'Clawback')) {
    const op_ = body.Clawback;
    return {
      type: 'clawback',
      asset: Asset._fromModern(op_.asset),
      from: muxedAccountToAddress(op_.from),
      amount: fromStroops(op_.amount.toString()),
      source,
    };
  }

  if (is(body, 'ClawbackClaimableBalance')) {
    const op_ = body.ClawbackClaimableBalance;
    return {
      type: 'clawbackClaimableBalance',
      balanceId: op_.balanceID,
      source,
    };
  }

  if (is(body, 'SetTrustLineFlags')) {
    const op_ = body.SetTrustLineFlags;
    return {
      type: 'setTrustLineFlags',
      trustor: accountIdToAddress(op_.trustor),
      asset: Asset._fromModern(op_.asset),
      clearFlags: op_.clearFlags,
      setFlags: op_.setFlags,
      source,
    };
  }

  if (is(body, 'LiquidityPoolDeposit')) {
    const op_ = body.LiquidityPoolDeposit;
    return {
      type: 'liquidityPoolDeposit',
      liquidityPoolId: bytesToHex(op_.liquidityPoolID),
      maxAmountA: fromStroops(op_.maxAmountA.toString()),
      maxAmountB: fromStroops(op_.maxAmountB.toString()),
      minPrice: `${op_.minPrice.n}/${op_.minPrice.d}`,
      maxPrice: `${op_.maxPrice.n}/${op_.maxPrice.d}`,
      source,
    };
  }

  if (is(body, 'LiquidityPoolWithdraw')) {
    const op_ = body.LiquidityPoolWithdraw;
    return {
      type: 'liquidityPoolWithdraw',
      liquidityPoolId: bytesToHex(op_.liquidityPoolID),
      amount: fromStroops(op_.amount.toString()),
      minAmountA: fromStroops(op_.minAmountA.toString()),
      minAmountB: fromStroops(op_.minAmountB.toString()),
      source,
    };
  }

  if (is(body, 'InvokeHostFunction')) {
    const op_ = body.InvokeHostFunction;
    return {
      type: 'invokeHostFunction',
      func: op_.hostFunction,
      auth: op_.auth,
      source,
    };
  }

  if (is(body, 'ExtendFootprintTtl')) {
    const op_ = body.ExtendFootprintTtl;
    return {
      type: 'extendFootprintTtl',
      extendTo: op_.extendTo,
      source,
    };
  }

  if (is(body, 'RestoreFootprint')) {
    return {
      type: 'restoreFootprint',
      source,
    };
  }

  // Fallback: return the raw body with type unknown
  return { type: 'unknown', body, source };
}

// ---------------------------------------------------------------------------
// Operation — static factories (class is internal, exported as value + type)
// ---------------------------------------------------------------------------

class OperationStatic {
  static createAccount(opts: OperationOpts & { destination: string; startingBalance: string }) {
    return wrap(modernCreateAccount({
      destination: opts.destination,
      startingBalance: amountToBigInt(opts.startingBalance),
      source: opts.source,
    }));
  }

  static payment(opts: OperationOpts & { destination: string; asset: Asset; amount: string }) {
    return wrap(modernPayment({
      destination: opts.destination,
      asset: opts.asset._toModern(),
      amount: amountToBigInt(opts.amount),
      source: opts.source,
    }));
  }

  static pathPaymentStrictReceive(opts: OperationOpts & {
    sendAsset: Asset; sendMax: string; destination: string;
    destAsset: Asset; destAmount: string; path: Asset[];
  }) {
    return wrap(modernPathPaymentStrictReceive({
      sendAsset: opts.sendAsset._toModern(),
      sendMax: amountToBigInt(opts.sendMax),
      destination: opts.destination,
      destAsset: opts.destAsset._toModern(),
      destAmount: amountToBigInt(opts.destAmount),
      path: opts.path.map(a => a._toModern()),
      source: opts.source,
    }));
  }

  static pathPaymentStrictSend(opts: OperationOpts & {
    sendAsset: Asset; sendAmount: string; destination: string;
    destAsset: Asset; destMin: string; path: Asset[];
  }) {
    return wrap(modernPathPaymentStrictSend({
      sendAsset: opts.sendAsset._toModern(),
      sendAmount: amountToBigInt(opts.sendAmount),
      destination: opts.destination,
      destAsset: opts.destAsset._toModern(),
      destMin: amountToBigInt(opts.destMin),
      path: opts.path.map(a => a._toModern()),
      source: opts.source,
    }));
  }

  static manageSellOffer(opts: OperationOpts & {
    selling: Asset; buying: Asset; amount: string;
    price: string | { n: number; d: number }; offerId?: string;
  }) {
    return wrap(modernManageSellOffer({
      selling: opts.selling._toModern(),
      buying: opts.buying._toModern(),
      amount: amountToBigInt(opts.amount),
      price: priceObj(opts.price),
      offerID: opts.offerId ? BigInt(opts.offerId) : undefined,
      source: opts.source,
    }));
  }

  static manageBuyOffer(opts: OperationOpts & {
    selling: Asset; buying: Asset; buyAmount: string;
    price: string | { n: number; d: number }; offerId?: string;
  }) {
    return wrap(modernManageBuyOffer({
      selling: opts.selling._toModern(),
      buying: opts.buying._toModern(),
      buyAmount: amountToBigInt(opts.buyAmount),
      price: priceObj(opts.price),
      offerID: opts.offerId ? BigInt(opts.offerId) : undefined,
      source: opts.source,
    }));
  }

  static createPassiveSellOffer(opts: OperationOpts & {
    selling: Asset; buying: Asset; amount: string;
    price: string | { n: number; d: number };
  }) {
    return wrap(modernCreatePassiveSellOffer({
      selling: opts.selling._toModern(),
      buying: opts.buying._toModern(),
      amount: amountToBigInt(opts.amount),
      price: priceObj(opts.price),
      source: opts.source,
    }));
  }

  static setOptions(opts: OperationOpts & {
    inflationDest?: string; clearFlags?: number; setFlags?: number;
    masterWeight?: number; lowThreshold?: number; medThreshold?: number;
    highThreshold?: number; homeDomain?: string; signer?: any;
  }) {
    return wrap(modernSetOptions({
      inflationDest: opts.inflationDest,
      clearFlags: opts.clearFlags,
      setFlags: opts.setFlags,
      masterWeight: opts.masterWeight,
      lowThreshold: opts.lowThreshold,
      medThreshold: opts.medThreshold,
      highThreshold: opts.highThreshold,
      homeDomain: opts.homeDomain,
      signer: opts.signer,
      source: opts.source,
    }));
  }

  static changeTrust(opts: OperationOpts & { asset: Asset; limit?: string }) {
    return wrap(modernChangeTrust({
      asset: opts.asset._toModern() as any,
      limit: opts.limit ? amountToBigInt(opts.limit) : undefined,
      source: opts.source,
    }));
  }

  static allowTrust(opts: OperationOpts & { trustor: string; assetCode: string; authorize: number }) {
    return wrap(modernAllowTrust({
      trustor: opts.trustor,
      assetCode: opts.assetCode,
      authorize: opts.authorize,
      source: opts.source,
    }));
  }

  static accountMerge(opts: OperationOpts & { destination: string }) {
    return wrap(modernAccountMerge({
      destination: opts.destination,
      source: opts.source,
    }));
  }

  static inflation(opts?: OperationOpts) {
    return wrap(modernInflation(opts));
  }

  static manageData(opts: OperationOpts & { name: string; value: Uint8Array | string | null }) {
    let valueBytes: Uint8Array | null = null;
    if (typeof opts.value === 'string') {
      valueBytes = new TextEncoder().encode(opts.value);
    } else {
      valueBytes = opts.value;
    }
    return wrap(modernManageData({
      name: opts.name,
      value: valueBytes,
      source: opts.source,
    }));
  }

  static bumpSequence(opts: OperationOpts & { bumpTo: string }) {
    return wrap(modernBumpSequence({
      bumpTo: BigInt(opts.bumpTo),
      source: opts.source,
    }));
  }

  static createClaimableBalance(opts: OperationOpts & { asset: Asset; amount: string; claimants: any[] }) {
    return wrap(modernCreateClaimableBalance({
      asset: opts.asset._toModern(),
      amount: amountToBigInt(opts.amount),
      claimants: opts.claimants.map((c: any) => c._toModern()),
      source: opts.source,
    }));
  }

  static claimClaimableBalance(opts: OperationOpts & { balanceId: string }) {
    // balanceId is hex-encoded — convert to proper structure
    const hashBytes = hexToBytes(opts.balanceId);
    return wrap(modernClaimClaimableBalance({
      balanceID: { ClaimableBalanceIdTypeV0: hashBytes },
      source: opts.source,
    }));
  }

  static beginSponsoringFutureReserves(opts: OperationOpts & { sponsoredId: string }) {
    return wrap(modernBeginSponsoringFutureReserves({
      sponsoredID: opts.sponsoredId,
      source: opts.source,
    }));
  }

  static endSponsoringFutureReserves(opts?: OperationOpts) {
    return wrap(modernEndSponsoringFutureReserves(opts));
  }

  static clawback(opts: OperationOpts & { asset: Asset; from: string; amount: string }) {
    return wrap(modernClawback({
      asset: opts.asset._toModern(),
      from: opts.from,
      amount: amountToBigInt(opts.amount),
      source: opts.source,
    }));
  }

  static clawbackClaimableBalance(opts: OperationOpts & { balanceId: string }) {
    const hashBytes = hexToBytes(opts.balanceId);
    return wrap(modernClawbackClaimableBalance({
      balanceID: { ClaimableBalanceIdTypeV0: hashBytes },
      source: opts.source,
    }));
  }

  static setTrustLineFlags(opts: OperationOpts & {
    trustor: string; asset: Asset; clearFlags: number; setFlags: number;
  }) {
    return wrap(modernSetTrustLineFlags({
      trustor: opts.trustor,
      asset: opts.asset._toModern(),
      clearFlags: opts.clearFlags,
      setFlags: opts.setFlags,
      source: opts.source,
    }));
  }

  static liquidityPoolDeposit(opts: OperationOpts & {
    liquidityPoolId: string; maxAmountA: string; maxAmountB: string;
    minPrice: string | { n: number; d: number }; maxPrice: string | { n: number; d: number };
  }) {
    return wrap(modernLiquidityPoolDeposit({
      liquidityPoolID: hexToBytes(opts.liquidityPoolId),
      maxAmountA: amountToBigInt(opts.maxAmountA),
      maxAmountB: amountToBigInt(opts.maxAmountB),
      minPrice: priceObj(opts.minPrice),
      maxPrice: priceObj(opts.maxPrice),
      source: opts.source,
    }));
  }

  static liquidityPoolWithdraw(opts: OperationOpts & {
    liquidityPoolId: string; amount: string; minAmountA: string; minAmountB: string;
  }) {
    return wrap(modernLiquidityPoolWithdraw({
      liquidityPoolID: hexToBytes(opts.liquidityPoolId),
      amount: amountToBigInt(opts.amount),
      minAmountA: amountToBigInt(opts.minAmountA),
      minAmountB: amountToBigInt(opts.minAmountB),
      source: opts.source,
    }));
  }

  static invokeHostFunction(opts: OperationOpts & { func: any; auth?: any[] }) {
    return wrap(modernInvokeHostFunction({
      hostFunction: opts.func,
      auth: opts.auth ?? [],
      source: opts.source,
    }));
  }

  static extendFootprintTtl(opts: OperationOpts & { extendTo: number }) {
    return wrap(modernExtendFootprintTtl({
      extendTo: opts.extendTo,
      source: opts.source,
    }));
  }

  static restoreFootprint(opts?: OperationOpts) {
    return wrap(modernRestoreFootprint(opts));
  }

  // Amount utilities
  static toStroops(amount: string): string {
    return toStroops(amount);
  }

  static fromStroops(stroops: string): string {
    return fromStroops(stroops);
  }

  // Decode XDR operation into flat compat object
  static fromXDRObject(xdrOp: any): Operation {
    // Accept both compat xdr.Operation (with _toModern) and modern Operation
    const modern: ModernOperation = xdrOp._toModern ? xdrOp._toModern() : xdrOp;
    return decodeOperation(modern);
  }
}

// ---------------------------------------------------------------------------
// Operation — exported as value (static methods) + type (decoded union) + namespace (sub-types)
// ---------------------------------------------------------------------------

// The value: provides static factory methods and fromXDRObject
export const Operation: typeof OperationStatic = OperationStatic;

// The type: a decoded operation is a discriminated union of all sub-types
export type Operation =
  | Operation.CreateAccount
  | Operation.Payment
  | Operation.PathPaymentStrictReceive
  | Operation.PathPaymentStrictSend
  | Operation.ManageSellOffer
  | Operation.ManageBuyOffer
  | Operation.CreatePassiveSellOffer
  | Operation.SetOptions
  | Operation.ChangeTrust
  | Operation.AllowTrust
  | Operation.AccountMerge
  | Operation.Inflation
  | Operation.ManageData
  | Operation.BumpSequence
  | Operation.CreateClaimableBalance
  | Operation.ClaimClaimableBalance
  | Operation.BeginSponsoringFutureReserves
  | Operation.EndSponsoringFutureReserves
  | Operation.RevokeSponsorship
  | Operation.Clawback
  | Operation.ClawbackClaimableBalance
  | Operation.SetTrustLineFlags
  | Operation.LiquidityPoolDeposit
  | Operation.LiquidityPoolWithdraw
  | Operation.InvokeHostFunction
  | Operation.ExtendFootprintTTL
  | Operation.RestoreFootprint;

// The namespace: sub-type interfaces for type narrowing (e.g., Operation.Payment)
export namespace Operation {
  export interface BaseOperation<T extends string = string> {
    type: T;
    source?: string;
    [key: string]: any;
  }

  export interface CreateAccount extends BaseOperation<'createAccount'> {
    destination: string;
    startingBalance: string;
  }

  export interface Payment extends BaseOperation<'payment'> {
    destination: string;
    asset: Asset;
    amount: string;
  }

  export interface PathPaymentStrictReceive extends BaseOperation<'pathPaymentStrictReceive'> {
    sendAsset: Asset;
    sendMax: string;
    destination: string;
    destAsset: Asset;
    destAmount: string;
    path: Asset[];
  }

  export interface PathPaymentStrictSend extends BaseOperation<'pathPaymentStrictSend'> {
    sendAsset: Asset;
    sendAmount: string;
    destination: string;
    destAsset: Asset;
    destMin: string;
    path: Asset[];
  }

  export interface ManageSellOffer extends BaseOperation<'manageSellOffer'> {
    selling: Asset;
    buying: Asset;
    amount: string;
    price: string;
    offerId: string;
  }

  export interface ManageBuyOffer extends BaseOperation<'manageBuyOffer'> {
    selling: Asset;
    buying: Asset;
    buyAmount: string;
    price: string;
    offerId: string;
  }

  export interface CreatePassiveSellOffer extends BaseOperation<'createPassiveSellOffer'> {
    selling: Asset;
    buying: Asset;
    amount: string;
    price: string;
  }

  export interface SetOptions extends BaseOperation<'setOptions'> {
    inflationDest?: string;
    clearFlags?: number;
    setFlags?: number;
    masterWeight?: number;
    lowThreshold?: number;
    medThreshold?: number;
    highThreshold?: number;
    homeDomain?: string;
    signer?: any;
  }

  export interface ChangeTrust extends BaseOperation<'changeTrust'> {
    line: Asset;
    limit: string;
  }

  export interface AllowTrust extends BaseOperation<'allowTrust'> {
    trustor: string;
    assetCode: string;
    authorize: number;
  }

  export interface AccountMerge extends BaseOperation<'accountMerge'> {
    destination: string;
  }

  export interface Inflation extends BaseOperation<'inflation'> {}

  export interface ManageData extends BaseOperation<'manageData'> {
    name: string;
    value: Uint8Array | null;
  }

  export interface BumpSequence extends BaseOperation<'bumpSequence'> {
    bumpTo: string;
  }

  export interface CreateClaimableBalance extends BaseOperation<'createClaimableBalance'> {
    asset: Asset;
    amount: string;
    claimants: any[];
  }

  export interface ClaimClaimableBalance extends BaseOperation<'claimClaimableBalance'> {
    balanceId: any;
  }

  export interface BeginSponsoringFutureReserves extends BaseOperation<'beginSponsoringFutureReserves'> {
    sponsoredId: string;
  }

  export interface EndSponsoringFutureReserves extends BaseOperation<'endSponsoringFutureReserves'> {}

  export interface RevokeSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeAccountSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeTrustlineSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeOfferSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeDataSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeClaimableBalanceSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeLiquidityPoolSponsorship extends BaseOperation<'revokeSponsorship'> {}
  export interface RevokeSignerSponsorship extends BaseOperation<'revokeSponsorship'> {}

  export interface Clawback extends BaseOperation<'clawback'> {
    asset: Asset;
    from: string;
    amount: string;
  }

  export interface ClawbackClaimableBalance extends BaseOperation<'clawbackClaimableBalance'> {
    balanceId: any;
  }

  export interface SetTrustLineFlags extends BaseOperation<'setTrustLineFlags'> {
    trustor: string;
    asset: Asset;
    clearFlags: number;
    setFlags: number;
  }

  export interface LiquidityPoolDeposit extends BaseOperation<'liquidityPoolDeposit'> {
    liquidityPoolId: string;
    maxAmountA: string;
    maxAmountB: string;
    minPrice: string;
    maxPrice: string;
  }

  export interface LiquidityPoolWithdraw extends BaseOperation<'liquidityPoolWithdraw'> {
    liquidityPoolId: string;
    amount: string;
    minAmountA: string;
    minAmountB: string;
  }

  export interface InvokeHostFunction extends BaseOperation<'invokeHostFunction'> {
    func: any;
    auth: any[];
  }

  export interface ExtendFootprintTTL extends BaseOperation<'extendFootprintTtl'> {
    extendTo: number;
  }

  export interface RestoreFootprint extends BaseOperation<'restoreFootprint'> {}
}

// ---------------------------------------------------------------------------
// OperationType namespace — string literal types for each operation
// ---------------------------------------------------------------------------

export namespace OperationType {
  export type CreateAccount = 'createAccount';
  export type Payment = 'payment';
  export type PathPaymentStrictReceive = 'pathPaymentStrictReceive';
  export type PathPaymentStrictSend = 'pathPaymentStrictSend';
  export type ManageSellOffer = 'manageSellOffer';
  export type ManageBuyOffer = 'manageBuyOffer';
  export type CreatePassiveSellOffer = 'createPassiveSellOffer';
  export type SetOptions = 'setOptions';
  export type ChangeTrust = 'changeTrust';
  export type AllowTrust = 'allowTrust';
  export type AccountMerge = 'accountMerge';
  export type Inflation = 'inflation';
  export type ManageData = 'manageData';
  export type BumpSequence = 'bumpSequence';
  export type CreateClaimableBalance = 'createClaimableBalance';
  export type ClaimClaimableBalance = 'claimClaimableBalance';
  export type BeginSponsoringFutureReserves = 'beginSponsoringFutureReserves';
  export type EndSponsoringFutureReserves = 'endSponsoringFutureReserves';
  export type RevokeSponsorship = 'revokeSponsorship';
  export type Clawback = 'clawback';
  export type ClawbackClaimableBalance = 'clawbackClaimableBalance';
  export type SetTrustLineFlags = 'setTrustLineFlags';
  export type LiquidityPoolDeposit = 'liquidityPoolDeposit';
  export type LiquidityPoolWithdraw = 'liquidityPoolWithdraw';
  export type InvokeHostFunction = 'invokeHostFunction';
  export type ExtendFootprintTTL = 'extendFootprintTtl';
  export type RestoreFootprint = 'restoreFootprint';
}

export type OperationType =
  | OperationType.CreateAccount
  | OperationType.Payment
  | OperationType.PathPaymentStrictReceive
  | OperationType.PathPaymentStrictSend
  | OperationType.ManageSellOffer
  | OperationType.ManageBuyOffer
  | OperationType.CreatePassiveSellOffer
  | OperationType.SetOptions
  | OperationType.ChangeTrust
  | OperationType.AllowTrust
  | OperationType.AccountMerge
  | OperationType.Inflation
  | OperationType.ManageData
  | OperationType.BumpSequence
  | OperationType.CreateClaimableBalance
  | OperationType.ClaimClaimableBalance
  | OperationType.BeginSponsoringFutureReserves
  | OperationType.EndSponsoringFutureReserves
  | OperationType.RevokeSponsorship
  | OperationType.Clawback
  | OperationType.ClawbackClaimableBalance
  | OperationType.SetTrustLineFlags
  | OperationType.LiquidityPoolDeposit
  | OperationType.LiquidityPoolWithdraw
  | OperationType.InvokeHostFunction
  | OperationType.ExtendFootprintTTL
  | OperationType.RestoreFootprint;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
