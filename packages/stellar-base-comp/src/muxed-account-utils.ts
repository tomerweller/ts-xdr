/**
 * Muxed account utility functions matching js-stellar-base.
 */

import {
  decodeStrkey,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_MUXED_ED25519,
} from '@stellar/strkey';
import { parseMuxedAccount } from '@stellar/tx-builder';
import { is, type MuxedAccount } from '@stellar/xdr';

/**
 * Decode a G- or M-address string into a modern MuxedAccount XDR object.
 */
export function decodeAddressToMuxedAccount(address: string): MuxedAccount {
  return parseMuxedAccount(address);
}

/**
 * Encode a modern MuxedAccount XDR object to a G- or M-address string.
 */
export function encodeMuxedAccountToAddress(muxedAccount: MuxedAccount): string {
  if (is(muxedAccount, 'Ed25519')) {
    return encodeStrkey(STRKEY_ED25519_PUBLIC, muxedAccount.Ed25519);
  }
  if (is(muxedAccount, 'MuxedEd25519')) {
    const payload = new Uint8Array(40);
    payload.set(muxedAccount.MuxedEd25519.ed25519, 0);
    const view = new DataView(payload.buffer);
    view.setBigUint64(32, muxedAccount.MuxedEd25519.id, false);
    return encodeStrkey(STRKEY_MUXED_ED25519, payload);
  }
  throw new Error('Unknown MuxedAccount type');
}

/**
 * Create a MuxedAccount XDR object from a G-address and a muxed ID string.
 */
export function encodeMuxedAccount(gAddress: string, id: string): MuxedAccount {
  const { payload } = decodeStrkey(gAddress);
  return {
    MuxedEd25519: {
      id: BigInt(id),
      ed25519: payload,
    },
  };
}

/**
 * Validate a Date object.
 */
export function isValidDate(d: any): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}
