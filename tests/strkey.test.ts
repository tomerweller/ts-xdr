import { describe, it, expect } from 'vitest';
import {
  encodeBase32,
  decodeBase32,
  crc16xmodem,
  encodeStrkey,
  decodeStrkey,
  strkeyFromString,
  strkeyToString,
  type Strkey,
  STRKEY_ED25519_PUBLIC,
  STRKEY_ED25519_PRIVATE,
  STRKEY_MUXED_ED25519,
  STRKEY_PRE_AUTH_TX,
  STRKEY_HASH_X,
  STRKEY_CONTRACT,
  STRKEY_SIGNED_PAYLOAD,
  STRKEY_LIQUIDITY_POOL,
  STRKEY_CLAIMABLE_BALANCE,
} from '../src/index.js';

// ---- Helpers ----

function assertRoundtrip(s: string, expected: Strkey) {
  const parsed = strkeyFromString(s);
  expect(parsed).toEqual(expected);
  expect(strkeyToString(parsed)).toBe(s);
}

// Common key bytes used across tests
const KEY1 = new Uint8Array([
  0x36, 0x3e, 0xaa, 0x38, 0x67, 0x84, 0x1f, 0xba, 0xd0, 0xf4, 0xed, 0x88,
  0xc7, 0x79, 0xe4, 0xfe, 0x66, 0xe5, 0x6a, 0x24, 0x70, 0xdc, 0x98, 0xc0,
  0xec, 0x9c, 0x07, 0x3d, 0x05, 0xc7, 0xb1, 0x03,
]);

const KEY2 = new Uint8Array([
  0x3f, 0x0c, 0x34, 0xbf, 0x93, 0xad, 0x0d, 0x99, 0x71, 0xd0, 0x4c, 0xcc,
  0x90, 0xf7, 0x05, 0x51, 0x1c, 0x83, 0x8a, 0xad, 0x97, 0x34, 0xa4, 0xa2,
  0xfb, 0x0d, 0x7a, 0x03, 0xfc, 0x7f, 0xe8, 0x9a,
]);

const KEY3 = new Uint8Array([
  0x69, 0xa8, 0xc4, 0xcb, 0xb9, 0xf6, 0x4e, 0x8a, 0x07, 0x98, 0xf6, 0xe1,
  0xac, 0x65, 0xd0, 0x6c, 0x31, 0x62, 0x92, 0x90, 0x56, 0xbc, 0xf4, 0xcd,
  0xb7, 0xd3, 0x73, 0x8d, 0x18, 0x55, 0xf3, 0x63,
]);

// ============================================================
// Base32
// ============================================================

describe('base32', () => {
  it('encodes empty', () => {
    expect(encodeBase32(new Uint8Array())).toBe('');
  });

  it('decodes empty', () => {
    expect(decodeBase32('')).toEqual(new Uint8Array());
  });

  it('roundtrips single byte', () => {
    const data = new Uint8Array([0x61]); // 'a'
    const encoded = encodeBase32(data);
    expect(encoded).toBe('ME');
    expect(decodeBase32(encoded)).toEqual(data);
  });

  it('roundtrips "Hello"', () => {
    const data = new TextEncoder().encode('Hello');
    const encoded = encodeBase32(data);
    expect(encoded).toBe('JBSWY3DP');
    expect(decodeBase32(encoded)).toEqual(data);
  });

  it('roundtrips arbitrary bytes', () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x42]);
    expect(decodeBase32(encodeBase32(data))).toEqual(data);
  });

  it('rejects invalid characters', () => {
    expect(() => decodeBase32('A0')).toThrow('Invalid base32 character');
    expect(() => decodeBase32('a')).toThrow('Invalid base32 character');
  });

  it('rejects non-zero unused trailing bits', () => {
    // 'ME' encodes 0x61 = 01100001. In base32: M=01100 E=00001.
    // Change E to F: M=01100 F=00101. Trailing bit 1 is non-zero.
    expect(() => decodeBase32('MF')).toThrow('trailing bits');
  });

  it('rejects invalid input lengths (congruent to 1, 3, 6 mod 8)', () => {
    // 1 mod 8
    expect(() => decodeBase32('A')).toThrow('Invalid base32 input length');
    // 3 mod 8
    expect(() => decodeBase32('AAA')).toThrow('Invalid base32 input length');
    // 6 mod 8
    expect(() => decodeBase32('AAAAAA')).toThrow('Invalid base32 input length');
  });
});

// ============================================================
// CRC16-XModem
// ============================================================

describe('crc16xmodem', () => {
  it('empty input -> 0', () => {
    expect(crc16xmodem(new Uint8Array())).toBe(0);
  });

  it('known test vector: "123456789"', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc16xmodem(data)).toBe(0x31c3);
  });

  it('single byte 0x00', () => {
    expect(crc16xmodem(new Uint8Array([0]))).toBe(0);
  });
});

// ============================================================
// Low-level strkey encode/decode
// ============================================================

describe('strkey encode/decode', () => {
  it('known G-address for all-zeros key', () => {
    const key = new Uint8Array(32);
    const strkey = encodeStrkey(STRKEY_ED25519_PUBLIC, key);
    expect(strkey).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
  });

  it('roundtrips ed25519 public key', () => {
    const strkey = encodeStrkey(STRKEY_ED25519_PUBLIC, KEY1);
    const decoded = decodeStrkey(strkey);
    expect(decoded.version).toBe(STRKEY_ED25519_PUBLIC);
    expect(decoded.payload).toEqual(KEY1);
  });

  it('rejects corrupted checksum', () => {
    const valid = encodeStrkey(STRKEY_ED25519_PUBLIC, new Uint8Array(32));
    const corrupted =
      valid.slice(0, -1) + (valid[valid.length - 1] === 'A' ? 'B' : 'A');
    expect(() => decodeStrkey(corrupted)).toThrow('checksum');
  });

  it('rejects too-short input', () => {
    expect(() => decodeStrkey('AAAA')).toThrow();
  });
});

// ============================================================
// Valid public keys
// ============================================================

describe('valid public keys', () => {
  it('GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQHES5', () => {
    assertRoundtrip('GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQHES5', {
      type: 'public_key_ed25519',
      data: KEY1,
    });
  });

  it('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ', () => {
    assertRoundtrip('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ', {
      type: 'public_key_ed25519',
      data: KEY2,
    });
  });
});

// ============================================================
// Valid private keys
// ============================================================

describe('valid private keys', () => {
  it('SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR', () => {
    assertRoundtrip('SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR', {
      type: 'private_key_ed25519',
      data: KEY3,
    });
  });
});

// ============================================================
// Valid pre-auth tx
// ============================================================

describe('valid pre-auth tx', () => {
  it('TBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHXL7', () => {
    assertRoundtrip('TBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHXL7', {
      type: 'pre_auth_tx',
      data: KEY3,
    });
  });
});

// ============================================================
// Valid hash-x
// ============================================================

describe('valid hash-x', () => {
  it('XBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWGTOG', () => {
    assertRoundtrip('XBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWGTOG', {
      type: 'hash_x',
      data: KEY3,
    });
  });
});

// ============================================================
// Valid muxed accounts
// ============================================================

describe('valid muxed accounts', () => {
  it('id: 123456', () => {
    assertRoundtrip(
      'MA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAAAAAAAAAPCICBKU',
      { type: 'muxed_account_ed25519', ed25519: KEY1, id: 123456n },
    );
  });

  it('id: 0', () => {
    assertRoundtrip(
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
      { type: 'muxed_account_ed25519', ed25519: KEY2, id: 0n },
    );
  });

  it('id exceeds max signed 64-bit (9223372036854775808)', () => {
    assertRoundtrip(
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK',
      {
        type: 'muxed_account_ed25519',
        ed25519: KEY2,
        id: 9223372036854775808n,
      },
    );
  });
});

// ============================================================
// Valid signed payloads
// ============================================================

describe('valid signed payloads', () => {
  it('32-byte inner payload', () => {
    const innerPayload = new Uint8Array([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
      0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
    ]);
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IBZGM',
      { type: 'signed_payload_ed25519', ed25519: KEY2, payload: innerPayload },
    );
  });

  it('29-byte inner payload', () => {
    const innerPayload = new Uint8Array([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
      0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d,
    ]);
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUAAAAFGBU',
      { type: 'signed_payload_ed25519', ed25519: KEY2, payload: innerPayload },
    );
  });

  it('0 unused trailing bits (16-byte zero payload)', () => {
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAKB5',
      {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: new Uint8Array(16),
      },
    );
  });

  it('1 unused trailing bit (4-byte zero payload)', () => {
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAACAAAAAABNWS',
      {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: new Uint8Array(4),
      },
    );
  });

  it('2 unused trailing bits (12-byte zero payload)', () => {
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAGAAAAAAAAAAAAAAAAAAACTPY',
      {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: new Uint8Array(12),
      },
    );
  });

  it('3 unused trailing bits (20-byte zero payload)', () => {
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXI',
      {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: new Uint8Array(20),
      },
    );
  });

  it('4 unused trailing bits (8-byte zero payload)', () => {
    assertRoundtrip(
      'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYQ',
      {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: new Uint8Array(8),
      },
    );
  });
});

// ============================================================
// Valid contracts
// ============================================================

describe('valid contracts', () => {
  it('CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE', () => {
    assertRoundtrip('CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE', {
      type: 'contract',
      data: KEY1,
    });
  });

  it('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA', () => {
    assertRoundtrip('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA', {
      type: 'contract',
      data: KEY2,
    });
  });
});

// ============================================================
// Valid liquidity pools
// ============================================================

describe('valid liquidity pools', () => {
  it('LA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGZ5J', () => {
    assertRoundtrip('LA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGZ5J', {
      type: 'liquidity_pool',
      data: KEY1,
    });
  });

  it('LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN', () => {
    assertRoundtrip('LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN', {
      type: 'liquidity_pool',
      data: KEY2,
    });
  });
});

// ============================================================
// Valid claimable balances
// ============================================================

describe('valid claimable balances', () => {
  it('BAADMPVKHBTYIH522D2O3CGHPHSP4ZXFNISHBXEYYDWJYBZ5AXD3CA3GDE', () => {
    assertRoundtrip(
      'BAADMPVKHBTYIH522D2O3CGHPHSP4ZXFNISHBXEYYDWJYBZ5AXD3CA3GDE',
      { type: 'claimable_balance_v0', data: KEY1 },
    );
  });

  it('BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU (2 unused trailing bits)', () => {
    assertRoundtrip(
      'BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU',
      { type: 'claimable_balance_v0', data: KEY2 },
    );
  });
});

// ============================================================
// Invalid public keys
// ============================================================

describe('invalid public keys', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV75ERQ'),
    ).toThrow();
  });

  it('rejects invalid length (Ed25519 should be 32 bytes, not 5)', () => {
    expect(() => strkeyFromString('GAAAAAAAACGC6')).toThrow();
  });

  it('rejects invalid length (congruent to 1 mod 8)', () => {
    expect(() =>
      strkeyFromString('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZA'),
    ).toThrow();
  });

  it('rejects invalid length (base-32 decoding should yield 35 bytes, not 36)', () => {
    expect(() =>
      strkeyFromString('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUACUSI'),
    ).toThrow();
  });

  it('rejects invalid algorithm (low 3 bits of version byte are 7)', () => {
    expect(() =>
      strkeyFromString('G47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVP2I'),
    ).toThrow();
  });

  it('rejects in-stream padding bytes', () => {
    expect(() =>
      strkeyFromString('G=3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQHES5'),
    ).toThrow();
  });
});

// ============================================================
// Invalid private keys
// ============================================================

describe('invalid private keys', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('SA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV764SE'),
    ).toThrow();
  });
});

// ============================================================
// Invalid pre-auth tx
// ============================================================

describe('invalid pre-auth tx', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('TA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV73QGA'),
    ).toThrow();
  });
});

// ============================================================
// Invalid hash-x
// ============================================================

describe('invalid hash-x', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('XA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV74CSY'),
    ).toThrow();
  });
});

// ============================================================
// Invalid muxed accounts
// ============================================================

describe('invalid muxed accounts', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUERUKZ4JVTO6777RIDA',
      ),
    ).toThrow();
  });

  it('rejects unused trailing bit not zero', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUR',
      ),
    ).toThrow();
  });

  it('rejects invalid length (congruent to 6 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLKA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (base-32 decoding should yield 43 bytes, not 44)', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAAV75I',
      ),
    ).toThrow();
  });

  it('rejects invalid algorithm (low 3 bits of version byte are 7)', () => {
    expect(() =>
      strkeyFromString(
        'M47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
      ),
    ).toThrow();
  });

  it('rejects padding bytes', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUK===',
      ),
    ).toThrow();
  });

  it('rejects invalid checksum', () => {
    expect(() =>
      strkeyFromString(
        'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUO',
      ),
    ).toThrow();
  });

  it('rejects too short', () => {
    expect(() => strkeyFromString('MA7QYNF7SOWQ3GLR2DMLK')).toThrow();
  });
});

// ============================================================
// Invalid signed payloads
// ============================================================

describe('invalid signed payloads', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD7ZIHA',
      ),
    ).toThrow();
  });

  it('rejects length prefix shorter than actual payload', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IAAAAAAAAPM',
      ),
    ).toThrow();
  });

  it('rejects length prefix longer than actual payload', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4Z2PQ',
      ),
    ).toThrow();
  });

  it('rejects no zero padding in signed payload', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DXFH6',
      ),
    ).toThrow();
  });

  it('rejects non-zero padding in signed payload', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAA4KVWLTJJFCJJFC7MPA7QYNF7SOWQ3GLR2GXUA7JUAAAAAEAAAAU',
      ),
    ).toThrow();
  });

  // 1 unused trailing bit (T instead of S)
  it('rejects 1 unused trailing bit not zero', () => {
    expect(() =>
      strkeyFromString(
        'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAACAAAAAABNWT',
      ),
    ).toThrow();
  });

  // 2 unused trailing bits (should be Y)
  const invalid2bit = [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAGAAAAAAAAAAAAAAAAAAACTPZ',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAGAAAAAAAAAAAAAAAAAAACTP2',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAGAAAAAAAAAAAAAAAAAAACTP3',
  ];
  for (const s of invalid2bit) {
    it(`rejects 2 unused trailing bits: ...${s.slice(-4)}`, () => {
      expect(() => strkeyFromString(s)).toThrow();
    });
  }

  // 3 unused trailing bits (should be I)
  const invalid3bit = [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXJ',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXK',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXL',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXM',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXN',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXO',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALGXP',
  ];
  for (const s of invalid3bit) {
    it(`rejects 3 unused trailing bits: ...${s.slice(-4)}`, () => {
      expect(() => strkeyFromString(s)).toThrow();
    });
  }

  // 4 unused trailing bits (should be Q)
  const invalid4bit = [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYR',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYS',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYT',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYU',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYV',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYW',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYX',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYY',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKYZ',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY2',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY3',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY4',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY5',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY6',
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAEAAAAAAAAAAAAARKY7',
  ];
  for (const s of invalid4bit) {
    it(`rejects 4 unused trailing bits: ...${s.slice(-4)}`, () => {
      expect(() => strkeyFromString(s)).toThrow();
    });
  }
});

// ============================================================
// Invalid contracts
// ============================================================

describe('invalid contracts', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV72WFI'),
    ).toThrow();
  });
});

// ============================================================
// Invalid liquidity pools
// ============================================================

describe('invalid liquidity pools', () => {
  it('rejects too long strkey input', () => {
    expect(() =>
      strkeyFromString('LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV7Z72Y'),
    ).toThrow();
  });

  it('rejects invalid length (should be 32 bytes, not 5)', () => {
    expect(() => strkeyFromString('LAAAAAAAADLH2')).toThrow();
  });

  it('rejects invalid length (congruent to 1 mod 8)', () => {
    expect(() =>
      strkeyFromString('LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJNA'),
    ).toThrow();
  });

  it('rejects invalid length (congruent to 3 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJNAAA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (congruent to 6 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJNAAAAAA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (base-32 decoding should yield 35 bytes, not 36)', () => {
    expect(() =>
      strkeyFromString('LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAGPZA'),
    ).toThrow();
  });

  it('rejects invalid algorithm (low 3 bits of version byte are 7)', () => {
    expect(() =>
      strkeyFromString('L47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUSV4'),
    ).toThrow();
  });

  it('rejects in-stream padding bytes', () => {
    expect(() =>
      strkeyFromString('L=A7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN'),
    ).toThrow();
  });
});

// ============================================================
// Invalid claimable balances
// ============================================================

describe('invalid claimable balances', () => {
  it('rejects too long strkey input (L prefix in Rust test)', () => {
    expect(() =>
      strkeyFromString(
        'LAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGX7FIWQ',
      ),
    ).toThrow();
  });

  it('rejects invalid length (should be 1+32 bytes, not 6)', () => {
    expect(() => strkeyFromString('BAAAAAAAAAAK3EY')).toThrow();
  });

  it('rejects invalid length (congruent to 3 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'BAADMPVKHBTYIH522D2O3CGHPHSP4ZXFNISHBXEYYDWJYBZ5AXD3CA3GDEA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (congruent to 6 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'BAADMPVKHBTYIH522D2O3CGHPHSP4ZXFNISHBXEYYDWJYBZ5AXD3CA3GDEAAAA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (congruent to 1 mod 8)', () => {
    expect(() =>
      strkeyFromString(
        'BAADMPVKHBTYIH522D2O3CGHPHSP4ZXFNISHBXEYYDWJYBZ5AXD3CA3GDEAAAAAAA',
      ),
    ).toThrow();
  });

  it('rejects invalid length (base-32 decoding should yield 35 bytes, not 36)', () => {
    expect(() =>
      strkeyFromString('BA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUADTYY'),
    ).toThrow();
  });

  it('rejects invalid algorithm (low 3 bits of version byte are 7)', () => {
    expect(() =>
      strkeyFromString('B47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVA4D'),
    ).toThrow();
  });

  it('rejects in-stream padding bytes', () => {
    expect(() =>
      strkeyFromString(
        'B=AAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU',
      ),
    ).toThrow();
  });

  // 2 unused trailing bits
  for (const lastChar of ['V', 'W', 'X']) {
    it(`rejects 2 unused trailing bits not zero (${lastChar} instead of U)`, () => {
      expect(() =>
        strkeyFromString(
          `BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4T${lastChar}`,
        ),
      ).toThrow();
    });
  }

  it('rejects invalid claimable balance type (0x01 instead of V0 0x00)', () => {
    expect(() =>
      strkeyFromString(
        'BAAT6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGXACA',
      ),
    ).toThrow();
  });
});

// ============================================================
// Signed payload sizes (parametric test: sizes 1..64)
// ============================================================

describe('signed payload sizes', () => {
  for (let payloadSize = 1; payloadSize <= 64; payloadSize++) {
    it(`roundtrips payload size ${payloadSize}`, () => {
      const innerPayload = new Uint8Array(payloadSize);
      for (let i = 0; i < payloadSize; i++) {
        innerPayload[i] = i;
      }

      const strkey: Strkey = {
        type: 'signed_payload_ed25519',
        ed25519: KEY2,
        payload: innerPayload,
      };

      const encoded = strkeyToString(strkey);
      const decoded = strkeyFromString(encoded);
      expect(decoded).toEqual(strkey);

      // Verify encoded length matches expected calculation
      const padding = (4 - (payloadSize % 4)) % 4;
      const rawPayloadLen = 32 + 4 + payloadSize + padding;
      const binaryLen = 1 + rawPayloadLen + 2;
      const expectedEncodedLen = Math.floor((binaryLen * 8 + 4) / 5);
      expect(encoded.length).toBe(expectedEncodedLen);
    });
  }
});
