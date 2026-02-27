/**
 * AssetType — string literal union matching the official @stellar/stellar-base type.
 */

export type AssetType =
  | 'native'
  | 'credit_alphanum4'
  | 'credit_alphanum12'
  | 'liquidity_pool_shares';
