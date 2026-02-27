/**
 * Sync Keypair compatible with js-stellar-base.
 *
 * Configures @noble/ed25519 for sync operations via @noble/hashes,
 * then provides a fully synchronous Keypair class.
 */

import { sha256 as nobleSha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import {
  getPublicKey,
  sign,
  verify,
  utils,
  etc,
} from '@noble/ed25519';
import {
  encodeStrkey,
  decodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_ED25519_PRIVATE,
} from '@stellar/strkey';
import { PublicKey, MuxedAccount } from './generated/stellar_compat.js';
import { augmentBuffer } from './signing.js';

// Configure sync SHA-512 for @noble/ed25519
etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(etc.concatBytes(...msgs));

export class Keypair {
  private readonly _publicKey: Uint8Array;
  private readonly _secretKey: Uint8Array | null;

  private constructor(publicKey: Uint8Array, secretKey: Uint8Array | null) {
    this._publicKey = publicKey;
    this._secretKey = secretKey;
  }

  static random(): Keypair {
    const secret = utils.randomPrivateKey();
    const pub = getPublicKey(secret);
    return new Keypair(pub, secret);
  }

  static fromSecret(sAddress: string): Keypair {
    const { version, payload } = decodeStrkey(sAddress);
    if (version !== STRKEY_ED25519_PRIVATE) {
      throw new Error('Expected ed25519 secret key (S-address)');
    }
    const pub = getPublicKey(payload);
    return new Keypair(pub, payload);
  }

  static fromRawEd25519Seed(bytes: Uint8Array): Keypair {
    if (bytes.length !== 32) {
      throw new Error('Secret key must be 32 bytes');
    }
    const pub = getPublicKey(bytes);
    return new Keypair(pub, bytes);
  }

  /**
   * Returns the master keypair derived from the network passphrase.
   */
  static master(networkPassphrase: string): Keypair {
    const seed = nobleSha256(new TextEncoder().encode(networkPassphrase));
    return Keypair.fromRawEd25519Seed(seed);
  }

  static fromPublicKey(gAddress: string): Keypair {
    const { version, payload } = decodeStrkey(gAddress);
    if (version !== STRKEY_ED25519_PUBLIC) {
      throw new Error('Expected ed25519 public key (G-address)');
    }
    return new Keypair(payload, null);
  }

  static fromRawPublicKey(bytes: Uint8Array): Keypair {
    if (bytes.length !== 32) {
      throw new Error('Public key must be 32 bytes');
    }
    return new Keypair(bytes, null);
  }

  get type(): string {
    return 'ed25519';
  }

  /** Returns the G-address string (method, not getter — matching js-stellar-base) */
  publicKey(): string {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, this._publicKey);
  }

  /** Returns the S-address string */
  secret(): string {
    if (this._secretKey === null) {
      throw new Error('No secret key available (public-only keypair)');
    }
    return encodeStrkey(STRKEY_ED25519_PRIVATE, this._secretKey);
  }

  rawPublicKey(): Uint8Array {
    return this._publicKey;
  }

  rawSecretKey(): Uint8Array {
    if (this._secretKey === null) {
      throw new Error('No secret key available (public-only keypair)');
    }
    return this._secretKey;
  }

  canSign(): boolean {
    return this._secretKey !== null;
  }

  signatureHint(): any {
    return augmentBuffer(this._publicKey.slice(-4));
  }

  sign(data: Uint8Array): any {
    if (this._secretKey === null) {
      throw new Error('Cannot sign: no secret key available');
    }
    return augmentBuffer(sign(data, this._secretKey));
  }

  signDecorated(data: Uint8Array): any {
    const signature = this.sign(data);
    return { hint: this.signatureHint(), signature };
  }

  /**
   * Sign data with a XORed hint for payload signers.
   * The hint is the last 4 bytes of the account XDR, XORed with the last 4 bytes of the payload.
   */
  signPayloadDecorated(data: Uint8Array): any {
    const signature = this.sign(data);
    const hint = new Uint8Array(this._publicKey.slice(-4));
    // XOR hint with last 4 bytes of the payload (data)
    const payloadEnd = data.slice(-4);
    for (let i = 0; i < 4; i++) {
      hint[i]! ^= payloadEnd[i] ?? 0;
    }
    return { hint: augmentBuffer(hint), signature };
  }

  verify(data: Uint8Array, signature: Uint8Array): boolean {
    return verify(signature, data, this._publicKey);
  }

  xdrPublicKey(): any {
    return (PublicKey as any).publicKeyTypeEd25519(this._publicKey);
  }

  xdrAccountId(): any {
    return this.xdrPublicKey();
  }

  xdrMuxedAccount(): any {
    return (MuxedAccount as any).keyTypeEd25519(this._publicKey);
  }
}
