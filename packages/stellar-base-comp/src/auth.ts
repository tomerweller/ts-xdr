/**
 * Soroban auth helpers — authorizeEntry / authorizeInvocation
 * Real signing implementation using modern XDR types.
 */

import {
  type SorobanAuthorizationEntry,
  type SorobanAuthorizedInvocation,
  HashIDPreimage as HashIDPreimageCodec,
  SorobanAuthorizationEntry as SorobanAuthorizationEntryCodec,
} from '@stellar/xdr';
import { decodeStrkey, STRKEY_ED25519_PUBLIC } from '@stellar/strkey';
import type { Keypair } from './keypair.js';
import { sha256 } from '@noble/hashes/sha256';

const encoder = new TextEncoder();

/**
 * Authorize a Soroban authorization entry by signing it with a keypair or callback.
 *
 * If the entry uses SourceAccount credentials, it is returned unchanged.
 * For Address credentials, the hash preimage is built, signed, and the
 * signature field is updated with a standard Vec([Map({public_key, signature})]).
 */
export async function authorizeEntry(
  entry: SorobanAuthorizationEntry | string,
  signer: Keypair | ((preimage: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array; publicKey: string }>),
  validUntilLedgerSeq: number,
  networkPassphrase: string,
): Promise<SorobanAuthorizationEntry> {
  // Parse from base64 if string
  let authEntry: SorobanAuthorizationEntry;
  if (typeof entry === 'string') {
    authEntry = SorobanAuthorizationEntryCodec.fromBase64(entry);
  } else {
    authEntry = entry;
  }

  // If not address credentials, nothing to sign
  if (typeof authEntry.credentials === 'string') {
    return authEntry;
  }

  const addrCreds = authEntry.credentials.Address;

  // Build the hash preimage
  const networkId = sha256(encoder.encode(networkPassphrase));

  const preimage: any = {
    SorobanAuthorization: {
      networkID: networkId,
      nonce: addrCreds.nonce,
      signatureExpirationLedger: validUntilLedgerSeq,
      invocation: authEntry.rootInvocation,
    },
  };

  // Serialize the preimage to XDR bytes, then SHA-256 hash
  const preimageXdr = HashIDPreimageCodec.toXdr(preimage);
  const payload = sha256(preimageXdr);

  // Sign the payload
  let sigBytes: Uint8Array;
  let publicKey: Uint8Array;

  if (typeof signer === 'function') {
    const result = await signer(payload);
    if (result && typeof result === 'object' && 'signature' in result) {
      sigBytes = result.signature;
      if (typeof result.publicKey === 'string') {
        const decoded = decodeStrkey(result.publicKey);
        publicKey = decoded.payload;
      } else {
        publicKey = new Uint8Array(32);
      }
    } else {
      sigBytes = result as Uint8Array;
      publicKey = new Uint8Array(32);
    }
  } else {
    sigBytes = signer.sign(payload);
    publicKey = signer.rawPublicKey();
  }

  // Build the signature SCVal: Vec([Map({public_key, signature})])
  const signatureScVal: any = {
    Vec: [{
      Map: [
        { key: { Symbol: 'public_key' }, val: { Bytes: publicKey } },
        { key: { Symbol: 'signature' }, val: { Bytes: sigBytes } },
      ],
    }],
  };

  // Return updated entry with new signature
  return {
    credentials: {
      Address: {
        address: addrCreds.address,
        nonce: addrCreds.nonce,
        signatureExpirationLedger: validUntilLedgerSeq,
        signature: signatureScVal,
      },
    },
    rootInvocation: authEntry.rootInvocation,
  };
}

/**
 * Create and sign a new SorobanAuthorizationEntry from an invocation.
 * Generates a random nonce, builds credentials from the signer's public key,
 * then delegates to authorizeEntry for signing.
 */
export async function authorizeInvocation(
  signer: Keypair | ((preimage: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array; publicKey: string }>),
  validUntilLedgerSeq: number,
  invocation: SorobanAuthorizedInvocation,
  publicKey?: string,
  networkPassphrase?: string,
): Promise<SorobanAuthorizationEntry> {
  // Generate random nonce (64-bit)
  const nonceBytes = crypto.getRandomValues(new Uint8Array(8));
  const view = new DataView(nonceBytes.buffer);
  const nonce = view.getBigInt64(0);

  // Determine the public key
  let pubKeyRaw: Uint8Array;
  if (publicKey) {
    const decoded = decodeStrkey(publicKey);
    pubKeyRaw = decoded.payload;
  } else if (typeof signer !== 'function') {
    pubKeyRaw = signer.rawPublicKey();
  } else {
    throw new Error('publicKey is required when using a signing callback');
  }

  // Build the SCAddress from the public key
  const address: any = { Account: { PublicKeyTypeEd25519: pubKeyRaw } };

  // Build a preliminary entry with empty signature
  const entry: SorobanAuthorizationEntry = {
    credentials: {
      Address: {
        address,
        nonce,
        signatureExpirationLedger: validUntilLedgerSeq,
        signature: 'Void' as any,
      },
    },
    rootInvocation: invocation,
  };

  // Delegate to authorizeEntry for the actual signing
  return authorizeEntry(
    entry,
    signer,
    validUntilLedgerSeq,
    networkPassphrase ?? '',
  );
}
