/**
 * Network constants matching js-stellar-base.
 */

export enum Networks {
  PUBLIC = 'Public Global Stellar Network ; September 2015',
  TESTNET = 'Test SDF Network ; September 2015',
  FUTURENET = 'Test SDF Future Network ; October 2022',
  SANDBOX = 'Local Sandbox Stellar Network ; September 2022',
  STANDALONE = 'Standalone Network ; February 2017',
}

export const BASE_FEE = '100';

export const TimeoutInfinite = 0;

// Auth flags
export const AuthRequiredFlag = 1;
export const AuthRevocableFlag = 2;
export const AuthImmutableFlag = 4;
export const AuthClawbackEnabledFlag = 8;

// Memo type constants
export const MemoNone = 'none';
export const MemoID = 'id';
export const MemoText = 'text';
export const MemoHash = 'hash';
export const MemoReturn = 'return';

// Liquidity pool fee (30 basis points = 0.3%)
export const LiquidityPoolFeeV18 = 30;

// Always true — we use @noble/ed25519 which is fast
export const FastSigning = true;
