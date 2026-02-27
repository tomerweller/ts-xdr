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
  declare readonly paging_token: string;
  declare readonly sponsor?: string;
  declare readonly num_sponsoring: number;
  declare readonly num_sponsored: number;

  constructor(record: AccountRecord) {
    super(record.account_id, record.sequence);
    Object.assign(this, record);
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
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  asset?: string;
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

const _OperationResponseType = {
  createAccount: 'create_account' as const,
  payment: 'payment' as const,
  pathPayment: 'path_payment_strict_receive' as const,
  createPassiveOffer: 'create_passive_sell_offer' as const,
  manageOffer: 'manage_sell_offer' as const,
  setOptions: 'set_options' as const,
  changeTrust: 'change_trust' as const,
  allowTrust: 'allow_trust' as const,
  accountMerge: 'account_merge' as const,
  inflation: 'inflation' as const,
  manageData: 'manage_data' as const,
  bumpSequence: 'bump_sequence' as const,
  manageBuyOffer: 'manage_buy_offer' as const,
  pathPaymentStrictSend: 'path_payment_strict_send' as const,
  createClaimableBalance: 'create_claimable_balance' as const,
  claimClaimableBalance: 'claim_claimable_balance' as const,
  beginSponsoringFutureReserves: 'begin_sponsoring_future_reserves' as const,
  endSponsoringFutureReserves: 'end_sponsoring_future_reserves' as const,
  revokeSponsorship: 'revoke_sponsorship' as const,
  clawback: 'clawback' as const,
  clawbackClaimableBalance: 'clawback_claimable_balance' as const,
  setTrustLineFlags: 'set_trust_line_flags' as const,
  liquidityPoolDeposit: 'liquidity_pool_deposit' as const,
  liquidityPoolWithdraw: 'liquidity_pool_withdraw' as const,
  invokeHostFunction: 'invoke_host_function' as const,
  bumpFootprintExpiration: 'bump_footprint_expiration' as const,
  restoreFootprint: 'restore_footprint' as const,
} as const;
export const OperationResponseType = _OperationResponseType;
