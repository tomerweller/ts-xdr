import { describe, it, expect } from 'vitest';
import { hash } from '../src/signing.js';

const expectedHex =
  'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('hash', () => {
  it('hashes a Uint8Array properly using SHA256', () => {
    const msg = new TextEncoder().encode('hello world');
    expect(toHex(hash(msg))).toBe(expectedHex);
  });

  it('hashes an array of bytes properly using SHA256', () => {
    const msg = new Uint8Array([
      104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
    ]);
    expect(toHex(hash(msg))).toBe(expectedHex);
  });

  it('returns 32 bytes', () => {
    const result = hash(new Uint8Array([1, 2, 3]));
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  it('produces consistent hashes', () => {
    const msg = new TextEncoder().encode('test data');
    const hash1 = hash(msg);
    const hash2 = hash(msg);
    expect(toHex(hash1)).toBe(toHex(hash2));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hash(new TextEncoder().encode('hello'));
    const hash2 = hash(new TextEncoder().encode('world'));
    expect(toHex(hash1)).not.toBe(toHex(hash2));
  });

  it('hashes empty input', () => {
    const result = hash(new Uint8Array(0));
    expect(result.length).toBe(32);
    // SHA256 of empty string
    expect(toHex(result)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
