/**
 * Contract namespace types matching @stellar/stellar-sdk contract module.
 */

// Numeric type aliases
export type u32 = number;
export type i32 = number;
export type u64 = bigint;
export type i64 = bigint;
export type u128 = bigint;
export type i128 = bigint;
export type u256 = bigint;
export type i256 = bigint;

// Time types
export type Timepoint = bigint;
export type Duration = bigint;

// Utility types
export type XDR_BASE64 = string;
export type Option<T> = T | undefined;

// Signing function types
export type SignTransaction = (
  xdr: string,
  options?: { networkPassphrase?: string; address?: string },
) => Promise<{ tx: string; signingPublicKey?: string }>;

export type SignAuthEntry = (
  xdr: string,
  options?: { networkPassphrase?: string; address?: string },
) => Promise<{ signature: string; signingPublicKey?: string }>;

// Error types
export interface ErrorMessage {
  message: string;
}

export interface WalletError {
  message: string;
  code: number;
  ext?: string[];
}

// Client options
export interface ClientOptions {
  publicKey?: string;
  signTransaction?: SignTransaction;
  signAuthEntry?: SignAuthEntry;
  contractId?: string;
  networkPassphrase: string;
  rpcUrl: string;
  allowHttp?: boolean;
  headers?: Record<string, string>;
  errorTypes?: Record<string, any>;
  server?: any;
}

// Method options
export interface MethodOptions {
  fee?: string;
  timeoutInSeconds?: number;
  simulate?: boolean;
  restore?: boolean;
  publicKey?: string;
  signTransaction?: SignTransaction;
  signAuthEntry?: SignAuthEntry;
}

// Constants
export const DEFAULT_TIMEOUT = 300;
export const NULL_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
