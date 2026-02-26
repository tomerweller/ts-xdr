/**
 * Strkey encoding/decoding for Stellar addresses.
 *
 * Implements RFC 4648 base32 (alphabet ABCDEFGHIJKLMNOPQRSTUVWXYZ234567, no
 * padding) and CRC16-XModem checksum, combined into the Stellar strkey format:
 *   base32(versionByte || payload || crc16(versionByte || payload))
 *
 * Zero external dependencies.
 */

// ---- Base32 (RFC 4648) ----

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const BASE32_DECODE_TABLE = new Uint8Array(128);
BASE32_DECODE_TABLE.fill(0xff);
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  BASE32_DECODE_TABLE[BASE32_ALPHABET.charCodeAt(i)!] = i;
}

export function encodeBase32(data: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i]!;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

export function decodeBase32(input: string): Uint8Array {
  const output: number[] = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 128) throw new Error(`Invalid base32 character: ${input[i]}`);
    const digit = BASE32_DECODE_TABLE[code]!;
    if (digit === 0xff) throw new Error(`Invalid base32 character: ${input[i]}`);
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }
  if (bits > 4) {
    throw new Error('Invalid base32 input length');
  }
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
    throw new Error('Non-zero unused trailing bits in base32 encoding');
  }
  return new Uint8Array(output);
}

// ---- CRC16-XModem ----

const CRC16_TABLE = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i << 8;
  for (let j = 0; j < 8; j++) {
    if (crc & 0x8000) {
      crc = ((crc << 1) ^ 0x1021) & 0xffff;
    } else {
      crc = (crc << 1) & 0xffff;
    }
  }
  CRC16_TABLE[i] = crc;
}

export function crc16xmodem(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) & 0xffff) ^ CRC16_TABLE[((crc >>> 8) ^ data[i]!) & 0xff]!;
  }
  return crc;
}

// ---- Version bytes ----

export const STRKEY_ED25519_PUBLIC = 6 << 3;   // 48 → 'G'
export const STRKEY_MUXED_ED25519 = 12 << 3;   // 96 → 'M'
export const STRKEY_PRE_AUTH_TX = 19 << 3;      // 152 → 'T'
export const STRKEY_HASH_X = 23 << 3;           // 184 → 'X'
export const STRKEY_CONTRACT = 2 << 3;          // 16 → 'C'
export const STRKEY_SIGNED_PAYLOAD = 15 << 3;   // 120 → 'P'
export const STRKEY_ED25519_PRIVATE = 18 << 3;   // 144 → 'S'
export const STRKEY_LIQUIDITY_POOL = 11 << 3;    // 88  → 'L'
export const STRKEY_CLAIMABLE_BALANCE = 1 << 3;  // 8   → 'B'

// ---- Strkey encode/decode ----

export function encodeStrkey(versionByte: number, payload: Uint8Array): string {
  const data = new Uint8Array(1 + payload.length + 2);
  data[0] = versionByte;
  data.set(payload, 1);
  const crc = crc16xmodem(data.subarray(0, 1 + payload.length));
  // CRC is little-endian
  data[1 + payload.length] = crc & 0xff;
  data[1 + payload.length + 1] = (crc >>> 8) & 0xff;
  return encodeBase32(data);
}

export function decodeStrkey(str: string): { version: number; payload: Uint8Array } {
  const data = decodeBase32(str);
  if (data.length < 3) {
    throw new Error('Strkey too short');
  }
  const version = data[0]!;
  const payload = data.subarray(1, data.length - 2);
  const expectedCrc = data[data.length - 2]! | (data[data.length - 1]! << 8);
  const actualCrc = crc16xmodem(data.subarray(0, data.length - 2));
  if (expectedCrc !== actualCrc) {
    throw new Error(
      `Strkey checksum mismatch: expected ${expectedCrc}, got ${actualCrc}`,
    );
  }
  return { version, payload };
}

// ---- Typed Strkey ----

export type Strkey =
  | { type: 'public_key_ed25519'; data: Uint8Array }
  | { type: 'private_key_ed25519'; data: Uint8Array }
  | { type: 'pre_auth_tx'; data: Uint8Array }
  | { type: 'hash_x'; data: Uint8Array }
  | { type: 'muxed_account_ed25519'; ed25519: Uint8Array; id: bigint }
  | { type: 'signed_payload_ed25519'; ed25519: Uint8Array; payload: Uint8Array }
  | { type: 'contract'; data: Uint8Array }
  | { type: 'liquidity_pool'; data: Uint8Array }
  | { type: 'claimable_balance_v0'; data: Uint8Array };

export function strkeyToString(strkey: Strkey): string {
  switch (strkey.type) {
    case 'public_key_ed25519':
      return encodeStrkey(STRKEY_ED25519_PUBLIC, strkey.data);
    case 'private_key_ed25519':
      return encodeStrkey(STRKEY_ED25519_PRIVATE, strkey.data);
    case 'pre_auth_tx':
      return encodeStrkey(STRKEY_PRE_AUTH_TX, strkey.data);
    case 'hash_x':
      return encodeStrkey(STRKEY_HASH_X, strkey.data);
    case 'contract':
      return encodeStrkey(STRKEY_CONTRACT, strkey.data);
    case 'liquidity_pool':
      return encodeStrkey(STRKEY_LIQUIDITY_POOL, strkey.data);
    case 'muxed_account_ed25519': {
      const payload = new Uint8Array(40);
      payload.set(strkey.ed25519, 0);
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      view.setBigUint64(32, strkey.id);
      return encodeStrkey(STRKEY_MUXED_ED25519, payload);
    }
    case 'signed_payload_ed25519': {
      const innerLen = strkey.payload.length;
      const padding = (4 - (innerLen % 4)) % 4;
      const payload = new Uint8Array(32 + 4 + innerLen + padding);
      payload.set(strkey.ed25519, 0);
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      view.setUint32(32, innerLen);
      payload.set(strkey.payload, 36);
      // padding bytes are already zero
      return encodeStrkey(STRKEY_SIGNED_PAYLOAD, payload);
    }
    case 'claimable_balance_v0': {
      const payload = new Uint8Array(33);
      payload[0] = 0x00; // V0 discriminant
      payload.set(strkey.data, 1);
      return encodeStrkey(STRKEY_CLAIMABLE_BALANCE, payload);
    }
  }
}

function decodeFixed32(
  type: Strkey['type'],
  payload: Uint8Array,
): Uint8Array {
  if (payload.length !== 32) {
    throw new Error(
      `Invalid ${type} strkey: expected 32 payload bytes, got ${payload.length}`,
    );
  }
  return new Uint8Array(payload);
}

export function strkeyFromString(s: string): Strkey {
  const { version, payload } = decodeStrkey(s);
  switch (version) {
    case STRKEY_ED25519_PUBLIC:
      return { type: 'public_key_ed25519', data: decodeFixed32('public_key_ed25519', payload) };
    case STRKEY_ED25519_PRIVATE:
      return { type: 'private_key_ed25519', data: decodeFixed32('private_key_ed25519', payload) };
    case STRKEY_PRE_AUTH_TX:
      return { type: 'pre_auth_tx', data: decodeFixed32('pre_auth_tx', payload) };
    case STRKEY_HASH_X:
      return { type: 'hash_x', data: decodeFixed32('hash_x', payload) };
    case STRKEY_CONTRACT:
      return { type: 'contract', data: decodeFixed32('contract', payload) };
    case STRKEY_LIQUIDITY_POOL:
      return { type: 'liquidity_pool', data: decodeFixed32('liquidity_pool', payload) };
    case STRKEY_MUXED_ED25519: {
      if (payload.length !== 40) {
        throw new Error(
          `Invalid muxed_account_ed25519 strkey: expected 40 payload bytes, got ${payload.length}`,
        );
      }
      const ed25519 = new Uint8Array(payload.subarray(0, 32));
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const id = view.getBigUint64(32);
      return { type: 'muxed_account_ed25519', ed25519, id };
    }
    case STRKEY_SIGNED_PAYLOAD: {
      if (payload.length < 36) {
        throw new Error(
          `Invalid signed_payload_ed25519 strkey: payload too short (${payload.length} bytes)`,
        );
      }
      const ed25519 = new Uint8Array(payload.subarray(0, 32));
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const innerLen = view.getUint32(32);
      if (innerLen > 64) {
        throw new Error(
          `Invalid signed_payload_ed25519 strkey: inner payload length ${innerLen} exceeds maximum 64`,
        );
      }
      const padding = (4 - (innerLen % 4)) % 4;
      const expectedTotal = 36 + innerLen + padding;
      if (payload.length !== expectedTotal) {
        throw new Error(
          `Invalid signed_payload_ed25519 strkey: expected ${expectedTotal} payload bytes, got ${payload.length}`,
        );
      }
      for (let i = 36 + innerLen; i < 36 + innerLen + padding; i++) {
        if (payload[i] !== 0) {
          throw new Error(
            'Invalid signed_payload_ed25519 strkey: non-zero padding bytes',
          );
        }
      }
      const innerPayload = new Uint8Array(payload.subarray(36, 36 + innerLen));
      return { type: 'signed_payload_ed25519', ed25519, payload: innerPayload };
    }
    case STRKEY_CLAIMABLE_BALANCE: {
      if (payload.length !== 33) {
        throw new Error(
          `Invalid claimable_balance strkey: expected 33 payload bytes, got ${payload.length}`,
        );
      }
      if (payload[0] !== 0x00) {
        throw new Error(
          `Invalid claimable_balance strkey: unknown subtype ${payload[0]}`,
        );
      }
      return { type: 'claimable_balance_v0', data: new Uint8Array(payload.subarray(1)) };
    }
    default:
      throw new Error(`Unknown strkey version byte: ${version}`);
  }
}
