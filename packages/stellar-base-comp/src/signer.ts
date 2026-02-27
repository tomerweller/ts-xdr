/**
 * Signer and SignerKeyOptions types matching the official @stellar/stellar-base.
 */

export namespace Signer {
  export interface Ed25519PublicKey {
    ed25519PublicKey: string;
    weight: number | undefined;
  }
  export interface Sha256Hash {
    sha256Hash: Uint8Array;
    weight: number | undefined;
  }
  export interface PreAuthTx {
    preAuthTx: Uint8Array;
    weight: number | undefined;
  }
  export interface Ed25519SignedPayload {
    ed25519SignedPayload: string;
    weight?: number | string;
  }
}

export type Signer =
  | Signer.Ed25519PublicKey
  | Signer.Sha256Hash
  | Signer.PreAuthTx
  | Signer.Ed25519SignedPayload;

export namespace SignerKeyOptions {
  export interface Ed25519PublicKey {
    ed25519PublicKey: string;
  }
  export interface Sha256Hash {
    sha256Hash: Uint8Array | string;
  }
  export interface PreAuthTx {
    preAuthTx: Uint8Array | string;
  }
  export interface Ed25519SignedPayload {
    ed25519SignedPayload: string;
  }
}

export type SignerKeyOptions =
  | SignerKeyOptions.Ed25519PublicKey
  | SignerKeyOptions.Sha256Hash
  | SignerKeyOptions.PreAuthTx
  | SignerKeyOptions.Ed25519SignedPayload;
