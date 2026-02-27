/**
 * SignerKey static namespace — decode/encode StrKey addresses to xdr.SignerKey.
 * Compatible with js-stellar-base.
 */

import {
  decodeStrkey,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_PRE_AUTH_TX,
  STRKEY_HASH_X,
  STRKEY_SIGNED_PAYLOAD,
} from '@stellar/strkey';

export const SignerKey = {
  /**
   * Decode a StrKey-encoded signer address to an xdr.SignerKey-shaped object.
   * Supports G (ed25519), T (pre-auth tx), X (sha256 hash), P (signed payload).
   */
  decodeAddress(address: string): any {
    const { version, payload } = decodeStrkey(address);
    switch (version) {
      case STRKEY_ED25519_PUBLIC:
        return { Ed25519: payload };
      case STRKEY_PRE_AUTH_TX:
        return { PreAuthTx: payload };
      case STRKEY_HASH_X:
        return { HashX: payload };
      case STRKEY_SIGNED_PAYLOAD: {
        // Signed payload: first 32 bytes = ed25519 key, rest = payload with 4-byte length prefix
        const ed25519 = payload.slice(0, 32);
        // The remaining bytes are: 4-byte big-endian length + variable-length payload
        const view = new DataView(payload.buffer, payload.byteOffset + 32, 4);
        const payloadLen = view.getUint32(0, false);
        const sigPayload = payload.slice(36, 36 + payloadLen);
        return {
          Ed25519SignedPayload: {
            ed25519,
            payload: sigPayload,
          },
        };
      }
      default:
        throw new Error(`Unknown signer key version: ${version}`);
    }
  },

  /**
   * Encode an xdr.SignerKey-shaped object to a StrKey string.
   */
  encodeSignerKey(signerKey: any): string {
    if (signerKey.Ed25519) {
      return encodeStrkey(STRKEY_ED25519_PUBLIC, signerKey.Ed25519);
    }
    if (signerKey.PreAuthTx) {
      return encodeStrkey(STRKEY_PRE_AUTH_TX, signerKey.PreAuthTx);
    }
    if (signerKey.HashX) {
      return encodeStrkey(STRKEY_HASH_X, signerKey.HashX);
    }
    if (signerKey.Ed25519SignedPayload) {
      const { ed25519, payload: sigPayload } = signerKey.Ed25519SignedPayload;
      // Reconstruct the signed payload format: 32-byte key + 4-byte length + payload + padding
      const padLen = (4 - (sigPayload.length % 4)) % 4;
      const buf = new Uint8Array(32 + 4 + sigPayload.length + padLen);
      buf.set(ed25519, 0);
      const view = new DataView(buf.buffer, 32, 4);
      view.setUint32(0, sigPayload.length, false);
      buf.set(sigPayload, 36);
      return encodeStrkey(STRKEY_SIGNED_PAYLOAD, buf);
    }
    throw new Error('Unknown SignerKey type');
  },
};
