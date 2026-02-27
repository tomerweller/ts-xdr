import type { AssetId } from './assets.js';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PageParams {
  cursor?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface Page<T> {
  records: T[];
  next?: string;
  prev?: string;
}

// ---------------------------------------------------------------------------
// Common sub-types
// ---------------------------------------------------------------------------

export type AssetType = 'native' | 'credit_alphanum4' | 'credit_alphanum12' | 'liquidity_pool_shares';

export interface PriceR {
  n: number;
  d: number;
}

export interface Flags {
  auth_required: boolean;
  auth_revocable: boolean;
  auth_immutable: boolean;
  auth_clawback_enabled: boolean;
}

export interface AccountThresholds {
  low_threshold: number;
  med_threshold: number;
  high_threshold: number;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface RootResponse {
  horizon_version: string;
  core_version: string;
  ingest_latest_ledger: number;
  history_latest_ledger: number;
  history_latest_ledger_closed_at: string;
  history_elder_ledger: number;
  core_latest_ledger: number;
  network_passphrase: string;
  current_protocol_version: number;
  supported_protocol_version: number;
  core_supported_protocol_version: number;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface BalanceLineNative {
  asset_type: 'native';
  balance: string;
  buying_liabilities: string;
  selling_liabilities: string;
}

export interface BalanceLineAsset {
  asset_type: 'credit_alphanum4' | 'credit_alphanum12';
  asset_code: string;
  asset_issuer: string;
  balance: string;
  limit: string;
  buying_liabilities: string;
  selling_liabilities: string;
  last_modified_ledger: number;
  is_authorized: boolean;
  is_authorized_to_maintain_liabilities: boolean;
  is_clawback_enabled: boolean;
  sponsor?: string;
}

export interface BalanceLineLiquidityPool {
  asset_type: 'liquidity_pool_shares';
  liquidity_pool_id: string;
  balance: string;
  limit: string;
  last_modified_ledger: number;
  is_authorized: boolean;
  is_authorized_to_maintain_liabilities: boolean;
  is_clawback_enabled: boolean;
  sponsor?: string;
}

export type BalanceLine = BalanceLineNative | BalanceLineAsset | BalanceLineLiquidityPool;

export interface AccountSigner {
  key: string;
  weight: number;
  type: string;
  sponsor?: string;
}

export interface AccountRecord {
  id: string;
  account_id: string;
  sequence: string;
  sequence_ledger?: number;
  sequence_time?: string;
  subentry_count: number;
  last_modified_ledger: number;
  last_modified_time: string;
  inflation_destination?: string;
  home_domain?: string;
  thresholds: AccountThresholds;
  flags: Flags;
  balances: BalanceLine[];
  signers: AccountSigner[];
  data: Record<string, string>;
  data_attr: Record<string, string>;
  sponsor?: string;
  num_sponsoring: number;
  num_sponsored: number;
  paging_token: string;
  [key: string]: any;
}

export interface AccountDataRecord {
  value: string;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface LedgerRecord {
  id: string;
  hash: string;
  prev_hash: string;
  sequence: number;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  tx_set_operation_count: number;
  closed_at: string;
  total_coins: string;
  fee_pool: string;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
  max_tx_set_size: number;
  protocol_version: number;
  header_xdr: string;
  paging_token: string;
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface FeeBumpTransactionInfo {
  hash: string;
  signatures: string[];
}

export interface InnerTransactionInfo {
  hash: string;
  signatures: string[];
  max_fee: string;
}

export interface TransactionPreconditions {
  timebounds?: { min_time: string; max_time: string };
  ledgerbounds?: { min_ledger: number; max_ledger: number };
  min_account_sequence?: string;
  min_account_sequence_age?: string;
  min_account_sequence_ledger_gap?: number;
  extra_signers?: string[];
}

export interface TransactionRecord {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_account: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  memo_bytes?: string;
  successful: boolean;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  fee_meta_xdr: string;
  signatures: string[];
  preconditions?: TransactionPreconditions;
  fee_bump_transaction?: FeeBumpTransactionInfo;
  inner_transaction?: InnerTransactionInfo;
  paging_token: string;
}

// ---------------------------------------------------------------------------
// Operation
// ---------------------------------------------------------------------------

export type OperationType =
  | 'create_account'
  | 'payment'
  | 'path_payment_strict_receive'
  | 'create_passive_sell_offer'
  | 'manage_sell_offer'
  | 'set_options'
  | 'change_trust'
  | 'allow_trust'
  | 'account_merge'
  | 'inflation'
  | 'manage_data'
  | 'bump_sequence'
  | 'manage_buy_offer'
  | 'path_payment_strict_send'
  | 'create_claimable_balance'
  | 'claim_claimable_balance'
  | 'begin_sponsoring_future_reserves'
  | 'end_sponsoring_future_reserves'
  | 'revoke_sponsorship'
  | 'clawback'
  | 'clawback_claimable_balance'
  | 'set_trust_line_flags'
  | 'liquidity_pool_deposit'
  | 'liquidity_pool_withdraw'
  | 'invoke_host_function'
  | 'extend_footprint_ttl'
  | 'restore_footprint';

export interface OperationRecord {
  id: string;
  paging_token: string;
  source_account: string;
  type: OperationType;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  transaction_successful: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

export interface EffectRecord {
  id: string;
  paging_token: string;
  account: string;
  type: string;
  type_i: number;
  created_at: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

export interface OfferAssetInfo {
  asset_type: AssetType;
  asset_code?: string;
  asset_issuer?: string;
}

export interface OfferRecord {
  id: string;
  paging_token: string;
  seller: string;
  selling: OfferAssetInfo;
  buying: OfferAssetInfo;
  amount: string;
  price_r: PriceR;
  price: string;
  last_modified_ledger: number;
  last_modified_time: string | null;
  sponsor?: string;
}

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

export interface TradeRecord {
  id: string;
  paging_token: string;
  ledger_close_time: string;
  trade_type: 'orderbook' | 'liquidity_pool';
  base_offer_id?: string;
  base_account?: string;
  base_liquidity_pool_id?: string;
  base_amount: string;
  base_asset_type: string;
  base_asset_code?: string;
  base_asset_issuer?: string;
  counter_offer_id?: string;
  counter_account?: string;
  counter_liquidity_pool_id?: string;
  counter_amount: string;
  counter_asset_type: string;
  counter_asset_code?: string;
  counter_asset_issuer?: string;
  base_is_seller: boolean;
  price: PriceR;
  liquidity_pool_fee_bp?: number;
}

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

export interface AssetAccounts {
  authorized: number;
  authorized_to_maintain_liabilities: number;
  unauthorized: number;
}

export interface AssetBalances {
  authorized: string;
  authorized_to_maintain_liabilities: string;
  unauthorized: string;
}

export interface AssetRecord {
  asset_type: 'credit_alphanum4' | 'credit_alphanum12';
  asset_code: string;
  asset_issuer: string;
  paging_token: string;
  accounts: AssetAccounts;
  balances: AssetBalances;
  num_claimable_balances: number;
  num_liquidity_pools: number;
  num_contracts: number;
  claimable_balances_amount: string;
  liquidity_pools_amount: string;
  contracts_amount: string;
  flags: Flags;
}

// ---------------------------------------------------------------------------
// Claimable Balance
// ---------------------------------------------------------------------------

export interface ClaimantPredicate {
  unconditional?: true;
  and?: ClaimantPredicate[];
  or?: ClaimantPredicate[];
  not?: ClaimantPredicate;
  abs_before?: string;
  rel_before?: string;
}

export interface Claimant {
  destination: string;
  predicate: ClaimantPredicate;
}

export interface ClaimableBalanceRecord {
  id: string;
  paging_token: string;
  asset: string;
  amount: string;
  sponsor: string;
  last_modified_ledger: number;
  last_modified_time: string | null;
  claimants: Claimant[];
  flags: { clawback_enabled: boolean };
}

// ---------------------------------------------------------------------------
// Liquidity Pool
// ---------------------------------------------------------------------------

export interface LiquidityPoolReserve {
  asset: string;
  amount: string;
}

export interface LiquidityPoolRecord {
  id: string;
  paging_token: string;
  fee_bp: number;
  type: string;
  total_trustlines: string;
  total_shares: string;
  reserves: LiquidityPoolReserve[];
  last_modified_ledger: number;
  last_modified_time: string;
}

// ---------------------------------------------------------------------------
// Fee Stats
// ---------------------------------------------------------------------------

export interface FeeDistribution {
  max: string;
  min: string;
  mode: string;
  p10: string;
  p20: string;
  p30: string;
  p40: string;
  p50: string;
  p60: string;
  p70: string;
  p80: string;
  p90: string;
  p95: string;
  p99: string;
}

export interface FeeStatsResponse {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: FeeDistribution;
  max_fee: FeeDistribution;
}

// ---------------------------------------------------------------------------
// Order Book
// ---------------------------------------------------------------------------

export interface OrderBookLevel {
  price_r: PriceR;
  price: string;
  amount: string;
}

export interface OrderBookResponse {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  base: OfferAssetInfo;
  counter: OfferAssetInfo;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface PathRecord {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: OfferAssetInfo[];
}

// ---------------------------------------------------------------------------
// Trade Aggregation
// ---------------------------------------------------------------------------

export interface TradeAggregationRecord {
  timestamp: string;
  trade_count: string;
  base_volume: string;
  counter_volume: string;
  avg: string;
  high: string;
  high_r: PriceR;
  low: string;
  low_r: PriceR;
  open: string;
  open_r: PriceR;
  close: string;
  close_r: PriceR;
}

// ---------------------------------------------------------------------------
// Submit Transaction
// ---------------------------------------------------------------------------

export interface SubmitTransactionResponse {
  hash: string;
  ledger: number;
  successful: boolean;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  paging_token: string;
}

export interface SubmitAsyncTransactionResponse {
  hash: string;
  tx_status: string;
  error_result_xdr?: string;
}

// ---------------------------------------------------------------------------
// Request param types
// ---------------------------------------------------------------------------

export interface AccountsParams extends PageParams {
  signer?: string;
  asset?: string;
  sponsor?: string;
  liquidity_pool?: string;
}

export interface TransactionsParams extends PageParams {
  include_failed?: boolean;
}

export interface OperationsParams extends PageParams {
  include_failed?: boolean;
}

export type EffectsParams = PageParams;

export interface PaymentsParams extends PageParams {
  include_failed?: boolean;
}

export type LedgersParams = PageParams;

export interface OffersParams extends PageParams {
  seller?: string;
  selling?: AssetId;
  buying?: AssetId;
  sponsor?: string;
}

export interface TradesParams extends PageParams {
  base_asset?: AssetId;
  counter_asset?: AssetId;
  offer_id?: string;
  trade_type?: 'orderbook' | 'liquidity_pool' | 'all';
}

export interface AssetsParams extends PageParams {
  asset_code?: string;
  asset_issuer?: string;
}

export interface ClaimableBalancesParams extends PageParams {
  sponsor?: string;
  claimant?: string;
  asset?: string;
}

export interface LiquidityPoolsParams extends PageParams {
  reserves?: string;
  account?: string;
}

export interface TradeAggregationsParams extends PageParams {
  base_asset: AssetId;
  counter_asset: AssetId;
  start_time: number;
  end_time: number;
  resolution: number;
  offset?: number;
}

export interface StrictReceivePathsParams {
  source_account?: string;
  source_assets?: AssetId[];
  destination_asset: AssetId;
  destination_amount: string;
}

export interface StrictSendPathsParams {
  source_asset: AssetId;
  source_amount: string;
  destination_account?: string;
  destination_assets?: AssetId[];
}

export interface OrderBookParams {
  selling: AssetId;
  buying: AssetId;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Streaming (SSE)
// ---------------------------------------------------------------------------

export interface StreamOptions<T> {
  cursor?: string;
  onMessage: (record: T) => void;
  onError?: (error: Error) => void;
}

export interface Stream {
  close(): void;
}
