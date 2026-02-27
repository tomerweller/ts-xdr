/**
 * Address class — unified G/M/C address handling, compatible with js-stellar-base.
 */

import {
  decodeStrkey,
  encodeStrkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_MUXED_ED25519,
  STRKEY_CONTRACT,
} from '@stellar/xdr';

export class Address {
  private readonly _address: string;
  private readonly _version: number;
  private readonly _payload: Uint8Array;

  constructor(address: string) {
    const { version, payload } = decodeStrkey(address);
    this._address = address;
    this._version = version;
    this._payload = payload;
  }

  static fromString(address: string): Address {
    return new Address(address);
  }

  static account(buffer: Uint8Array): Address {
    return new Address(encodeStrkey(STRKEY_ED25519_PUBLIC, buffer));
  }

  static contract(buffer: Uint8Array): Address {
    return new Address(encodeStrkey(STRKEY_CONTRACT, buffer));
  }

  static fromScVal(scVal: any): Address {
    // scVal should have shape { Address: ScAddress }
    if (scVal.Address) {
      return Address.fromScAddress(scVal.Address);
    }
    // Handle compat ScVal with accessor method
    if (typeof scVal.address === 'function') {
      return Address.fromScAddress(scVal.address());
    }
    throw new Error('Cannot extract Address from ScVal');
  }

  static fromScAddress(scAddress: any): Address {
    if ('Account' in scAddress) {
      const pk = scAddress.Account;
      if ('PublicKeyTypeEd25519' in pk) {
        return new Address(encodeStrkey(STRKEY_ED25519_PUBLIC, pk.PublicKeyTypeEd25519));
      }
    }
    if ('Contract' in scAddress) {
      return new Address(encodeStrkey(STRKEY_CONTRACT, scAddress.Contract));
    }
    // Handle compat ScAddress with accessor methods
    if (typeof scAddress.switch === 'function') {
      const switchVal = scAddress.switch();
      const name = typeof switchVal === 'string' ? switchVal : switchVal?.name;
      if (name === 'scAddressTypeAccount' && typeof scAddress.accountId === 'function') {
        const accountId = scAddress.accountId();
        const ed25519 = typeof accountId.ed25519 === 'function' ? accountId.ed25519() : accountId.PublicKeyTypeEd25519;
        return new Address(encodeStrkey(STRKEY_ED25519_PUBLIC, ed25519));
      }
      if (name === 'scAddressTypeContract' && typeof scAddress.contractId === 'function') {
        return new Address(encodeStrkey(STRKEY_CONTRACT, scAddress.contractId()));
      }
    }
    throw new Error('Unsupported SCAddress type');
  }

  toString(): string {
    return this._address;
  }

  toScAddress(): any {
    if (this._version === STRKEY_ED25519_PUBLIC) {
      return { Account: { PublicKeyTypeEd25519: this._payload } };
    }
    if (this._version === STRKEY_CONTRACT) {
      return { Contract: this._payload };
    }
    throw new Error(`Cannot convert address type ${this._version} to SCAddress`);
  }

  toScVal(): any {
    return { Address: this.toScAddress() };
  }

  toBuffer(): Uint8Array {
    return this._payload;
  }
}
