/**
 * StrKey utility object — wraps @stellar/strkey with the js-stellar-base API.
 */

import {
  encodeStrkey,
  decodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_ED25519_PRIVATE,
  STRKEY_PRE_AUTH_TX,
  STRKEY_HASH_X,
  STRKEY_MUXED_ED25519,
  STRKEY_SIGNED_PAYLOAD,
  STRKEY_CONTRACT,
  STRKEY_CLAIMABLE_BALANCE,
  STRKEY_LIQUIDITY_POOL,
} from '@stellar/strkey';

function encode(version: number, payload: Uint8Array): string {
  return encodeStrkey(version, payload);
}

function decode(str: string, expectedVersion: number): Uint8Array {
  const { version, payload } = decodeStrkey(str);
  if (version !== expectedVersion) {
    throw new Error(`Expected version ${expectedVersion}, got ${version}`);
  }
  return payload;
}

function isValid(str: string, expectedVersion: number): boolean {
  try {
    decode(str, expectedVersion);
    return true;
  } catch {
    return false;
  }
}

export const StrKey = {
  encodeEd25519PublicKey(data: Uint8Array): string {
    return encode(STRKEY_ED25519_PUBLIC, data);
  },
  decodeEd25519PublicKey(str: string): Uint8Array {
    return decode(str, STRKEY_ED25519_PUBLIC);
  },
  isValidEd25519PublicKey(str: string): boolean {
    return isValid(str, STRKEY_ED25519_PUBLIC);
  },

  encodeEd25519SecretSeed(data: Uint8Array): string {
    return encode(STRKEY_ED25519_PRIVATE, data);
  },
  decodeEd25519SecretSeed(str: string): Uint8Array {
    return decode(str, STRKEY_ED25519_PRIVATE);
  },
  isValidEd25519SecretSeed(str: string): boolean {
    return isValid(str, STRKEY_ED25519_PRIVATE);
  },

  encodePreAuthTx(data: Uint8Array): string {
    return encode(STRKEY_PRE_AUTH_TX, data);
  },
  decodePreAuthTx(str: string): Uint8Array {
    return decode(str, STRKEY_PRE_AUTH_TX);
  },
  isValidPreAuthTx(str: string): boolean {
    return isValid(str, STRKEY_PRE_AUTH_TX);
  },

  encodeSha256Hash(data: Uint8Array): string {
    return encode(STRKEY_HASH_X, data);
  },
  decodeSha256Hash(str: string): Uint8Array {
    return decode(str, STRKEY_HASH_X);
  },
  isValidSha256Hash(str: string): boolean {
    return isValid(str, STRKEY_HASH_X);
  },

  encodeMed25519PublicKey(data: Uint8Array): string {
    return encode(STRKEY_MUXED_ED25519, data);
  },
  decodeMed25519PublicKey(str: string): Uint8Array {
    return decode(str, STRKEY_MUXED_ED25519);
  },
  isValidMed25519PublicKey(str: string): boolean {
    return isValid(str, STRKEY_MUXED_ED25519);
  },

  encodeSignedPayload(data: Uint8Array): string {
    return encode(STRKEY_SIGNED_PAYLOAD, data);
  },
  decodeSignedPayload(str: string): Uint8Array {
    return decode(str, STRKEY_SIGNED_PAYLOAD);
  },
  isValidSignedPayload(str: string): boolean {
    return isValid(str, STRKEY_SIGNED_PAYLOAD);
  },

  encodeContract(data: Uint8Array): string {
    return encode(STRKEY_CONTRACT, data);
  },
  decodeContract(str: string): Uint8Array {
    return decode(str, STRKEY_CONTRACT);
  },
  isValidContract(str: string): boolean {
    return isValid(str, STRKEY_CONTRACT);
  },

  encodeClaimableBalance(data: Uint8Array): string {
    return encode(STRKEY_CLAIMABLE_BALANCE, data);
  },
  decodeClaimableBalance(str: string): Uint8Array {
    return decode(str, STRKEY_CLAIMABLE_BALANCE);
  },
  isValidClaimableBalance(str: string): boolean {
    return isValid(str, STRKEY_CLAIMABLE_BALANCE);
  },

  encodeLiquidityPool(data: Uint8Array): string {
    return encode(STRKEY_LIQUIDITY_POOL, data);
  },
  decodeLiquidityPool(str: string): Uint8Array {
    return decode(str, STRKEY_LIQUIDITY_POOL);
  },
  isValidLiquidityPool(str: string): boolean {
    return isValid(str, STRKEY_LIQUIDITY_POOL);
  },

  getVersionByteForPrefix(address: string): number {
    const { version } = decodeStrkey(address);
    return version;
  },

  types: {
    ed25519PublicKey: STRKEY_ED25519_PUBLIC,
    ed25519SecretSeed: STRKEY_ED25519_PRIVATE,
    preAuthTx: STRKEY_PRE_AUTH_TX,
    sha256Hash: STRKEY_HASH_X,
    med25519PublicKey: STRKEY_MUXED_ED25519,
    signedPayload: STRKEY_SIGNED_PAYLOAD,
    contract: STRKEY_CONTRACT,
    claimableBalance: STRKEY_CLAIMABLE_BALANCE,
    liquidityPool: STRKEY_LIQUIDITY_POOL,
  },
};
