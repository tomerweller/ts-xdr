/**
 * Horizon API types for the compat layer.
 * Re-exports record types from @stellar/horizon-client and adds
 * compat-specific types (CollectionPage, AccountResponse).
 */

import { Account } from '@stellar/stellar-base-comp';
import type {
  AccountRecord,
  BalanceLine,
  AccountSigner,
  AccountThresholds,
  Flags,
} from '@stellar/horizon-client';

// Re-export all record types from horizon-client
export type {
  RootResponse,
  FeeStatsResponse,
  FeeDistribution,
  AccountRecord,
  AccountDataRecord,
  BalanceLine,
  BalanceLineNative,
  BalanceLineAsset,
  BalanceLineLiquidityPool,
  AccountSigner,
  AccountThresholds,
  Flags,
  LedgerRecord,
  TransactionRecord,
  TransactionPreconditions,
  FeeBumpTransactionInfo,
  InnerTransactionInfo,
  OperationType,
  OperationRecord,
  EffectRecord,
  OfferRecord,
  OfferAssetInfo,
  TradeRecord,
  AssetRecord,
  AssetAccounts,
  AssetBalances,
  ClaimableBalanceRecord,
  Claimant,
  ClaimantPredicate,
  LiquidityPoolRecord,
  LiquidityPoolReserve,
  OrderBookResponse,
  OrderBookLevel,
  PathRecord,
  TradeAggregationRecord,
  SubmitTransactionResponse,
  SubmitAsyncTransactionResponse,
} from '@stellar/horizon-client';

// ---------------------------------------------------------------------------
// CollectionPage — paginated result with next()/prev()
// ---------------------------------------------------------------------------

export interface CollectionPage<T> {
  records: T[];
  next(): Promise<CollectionPage<T>>;
  prev(): Promise<CollectionPage<T>>;
}

// ---------------------------------------------------------------------------
// AccountResponse — returned by loadAccount(), usable with TransactionBuilder
// ---------------------------------------------------------------------------

export class AccountResponse extends Account {
  declare readonly id: string;
  declare readonly account_id: string;
  declare readonly subentry_count: number;
  declare readonly last_modified_ledger: number;
  declare readonly last_modified_time: string;
  declare readonly thresholds: AccountThresholds;
  declare readonly flags: Flags;
  declare readonly balances: BalanceLine[];
  declare readonly signers: AccountSigner[];
  declare readonly data: Record<string, string>;
  declare readonly data_attr: Record<string, string>;
  declare readonly paging_token: string;
  declare readonly sponsor?: string;
  declare readonly num_sponsoring: number;
  declare readonly num_sponsored: number;
  [key: string]: any;

  constructor(record: AccountRecord) {
    super(record.account_id, record.sequence);
    Object.assign(this, record);
    // Alias data as data_attr for compat
    if (!this.data_attr && this.data) {
      (this as any).data_attr = this.data;
    }
  }
}

// ---------------------------------------------------------------------------
// Type aliases for Freighter compat
// ---------------------------------------------------------------------------

export type TransactionResponse = import('@stellar/horizon-client').SubmitTransactionResponse;
export type PaymentPathRecord = import('@stellar/horizon-client').PathRecord;

// ---------------------------------------------------------------------------
// Reserve — used by Freighter for liquidity pool reserve info
// ---------------------------------------------------------------------------

export interface Reserve {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  asset: string;
  amount: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// ErrorResponseData — nested namespace used by Freighter
// ---------------------------------------------------------------------------

export namespace ErrorResponseData {
  export interface TransactionFailed {
    type: string;
    title: string;
    status: number;
    detail: string;
    extras?: {
      envelope_xdr?: string;
      result_xdr?: string;
      result_codes?: {
        transaction?: string;
        operations?: string[];
      };
      [key: string]: any;
    };
    [key: string]: any;
  }
}

// ---------------------------------------------------------------------------
// OperationResponseType — runtime enum matching the official SDK
// ---------------------------------------------------------------------------

export const OperationResponseType: { readonly [key: string]: string } = {
  createAccount: 'create_account',
  payment: 'payment',
  pathPayment: 'path_payment_strict_receive',
  createPassiveOffer: 'create_passive_sell_offer',
  manageOffer: 'manage_sell_offer',
  setOptions: 'set_options',
  changeTrust: 'change_trust',
  allowTrust: 'allow_trust',
  accountMerge: 'account_merge',
  inflation: 'inflation',
  manageData: 'manage_data',
  bumpSequence: 'bump_sequence',
  manageBuyOffer: 'manage_buy_offer',
  pathPaymentStrictSend: 'path_payment_strict_send',
  createClaimableBalance: 'create_claimable_balance',
  claimClaimableBalance: 'claim_claimable_balance',
  beginSponsoringFutureReserves: 'begin_sponsoring_future_reserves',
  endSponsoringFutureReserves: 'end_sponsoring_future_reserves',
  revokeSponsorship: 'revoke_sponsorship',
  clawback: 'clawback',
  clawbackClaimableBalance: 'clawback_claimable_balance',
  setTrustLineFlags: 'set_trust_line_flags',
  liquidityPoolDeposit: 'liquidity_pool_deposit',
  liquidityPoolWithdraw: 'liquidity_pool_withdraw',
  invokeHostFunction: 'invoke_host_function',
  bumpFootprintExpiration: 'bump_footprint_expiration',
  extendFootprintTtl: 'extend_footprint_ttl',
  restoreFootprint: 'restore_footprint',
};
// Type includes all OperationType values from horizon-client for compat
export type OperationResponseType = string;

// ---------------------------------------------------------------------------
// Constants matching official SDK
// ---------------------------------------------------------------------------

/** Default timeout for submitTransaction (ms) */
export const SUBMIT_TRANSACTION_TIMEOUT = 60 * 1000;

/** Server time tracking map: serverUrl → { serverTime, localTimeRecorded } */
export const SERVER_TIME_MAP: Record<string, { serverTime: number; localTimeRecorded: number }> = {};

/** Get the current time for a given Horizon server */
export function getCurrentServerTime(serverUrl: string): number {
  const entry = SERVER_TIME_MAP[serverUrl];
  if (!entry) return Math.floor(Date.now() / 1000);
  const drift = Math.floor(Date.now() / 1000) - entry.localTimeRecorded;
  return entry.serverTime + drift;
}

// ---------------------------------------------------------------------------
// EventSource / streaming types
// ---------------------------------------------------------------------------

export interface EventSourceOptions<T> {
  onmessage?: (record: T) => void;
  onerror?: (error: Error) => void;
  reconnectTimeout?: number;
}
