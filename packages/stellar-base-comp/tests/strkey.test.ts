import { describe, it, expect } from 'vitest';
import { StrKey } from '../src/strkey.js';

const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const SECRET1 = 'SDL2ENWLAB7NHNVZUWTSZO23D3YLF4YUKUBHLWDVHKNDFJ37VDQ2RI53';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

describe('StrKey', () => {
  describe('#decodeCheck', () => {
    it('decodes ed25519 public key correctly', () => {
      const raw = StrKey.decodeEd25519PublicKey(PUBKEY1);
      expect(raw.length).toBe(32);
      const encoded = StrKey.encodeEd25519PublicKey(raw);
      expect(encoded).toBe(PUBKEY1);
    });

    it('decodes ed25519 secret seed correctly', () => {
      const raw = StrKey.decodeEd25519SecretSeed(SECRET1);
      expect(raw.length).toBe(32);
      const encoded = StrKey.encodeEd25519SecretSeed(raw);
      expect(encoded).toBe(SECRET1);
    });

    it('throws when the version byte is wrong', () => {
      // Try to decode a G-address as a secret seed
      expect(() =>
        StrKey.decodeEd25519SecretSeed(
          'GBPXXOA5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVL',
        ),
      ).toThrow();
      // Try to decode an S-address as a public key
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'SBGWKM3CD4IL47QN6X54N6Y33T3JDNVI6AIJ6CD5IM47HG3IG4O36XCU',
        ),
      ).toThrow();
    });

    it('throws when decoded data encodes to other string (invalid encoding)', () => {
      // Invalid base32 characters or bad checksums in public keys
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'GBPXX0A5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVL',
        ),
      ).toThrow();
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'GCFZB6L25D26RQFDWSSBDEYQ32JHLRMTT44ZYE3DZQUTYOL7WY43PLBG++',
        ),
      ).toThrow();
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'GADE5QJ2TY7S5ZB65Q43DFGWYWCPHIYDJ2326KZGAGBN7AE5UY6JVDRRA',
        ),
      ).toThrow();
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2',
        ),
      ).toThrow();
    });

    it('throws when checksum is wrong', () => {
      expect(() =>
        StrKey.decodeEd25519PublicKey(
          'GBPXXOA5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVT',
        ),
      ).toThrow();
      expect(() =>
        StrKey.decodeEd25519SecretSeed(
          'SBGWKM3CD4IL47QN6X54N6Y33T3JDNVI6AIJ6CD5IM47HG3IG4O36XCX',
        ),
      ).toThrow();
    });
  });

  describe('#encodeCheck', () => {
    it('encodes public key with G prefix', () => {
      const raw = StrKey.decodeEd25519PublicKey(PUBKEY1);
      const encoded = StrKey.encodeEd25519PublicKey(raw);
      expect(encoded).toMatch(/^G/);
      expect(encoded).toBe(PUBKEY1);
    });

    it('encodes secret seed with S prefix', () => {
      const raw = StrKey.decodeEd25519SecretSeed(SECRET1);
      const encoded = StrKey.encodeEd25519SecretSeed(raw);
      expect(encoded).toMatch(/^S/);
      expect(encoded).toBe(SECRET1);
    });

    it('encodes pre-auth tx with T prefix', () => {
      const raw = StrKey.decodeEd25519PublicKey(PUBKEY1);
      const encoded = StrKey.encodePreAuthTx(raw);
      expect(encoded).toMatch(/^T/);
      const decoded = StrKey.decodePreAuthTx(encoded);
      expect(toHex(decoded)).toBe(toHex(raw));
    });

    it('encodes SHA256 hash with X prefix', () => {
      const raw = StrKey.decodeEd25519PublicKey(PUBKEY1);
      const encoded = StrKey.encodeSha256Hash(raw);
      expect(encoded).toMatch(/^X/);
      const decoded = StrKey.decodeSha256Hash(encoded);
      expect(toHex(decoded)).toBe(toHex(raw));
    });
  });

  describe('#isValidEd25519PublicKey', () => {
    it('returns true for valid public keys', () => {
      const keys = [
        'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB',
        'GB7KKHHVYLDIZEKYJPAJUOTBE5E3NJAXPSDZK7O6O44WR3EBRO5HRPVT',
        'GD6WVYRVID442Y4JVWFWKWCZKB45UGHJAABBJRS22TUSTWGJYXIUR7N2',
        'GBCG42WTVWPO4Q6OZCYI3D6ZSTFSJIXIS6INCIUF23L6VN3ADE4337AP',
        'GDFX463YPLCO2EY7NGFMI7SXWWDQAMASGYZXCG2LATOF3PP5NQIUKBPT',
        'GBXEODUMM3SJ3QSX2VYUWFU3NRP7BQRC2ERWS7E2LZXDJXL2N66ZQ5PT',
        'GAJHORKJKDDEPYCD6URDFODV7CVLJ5AAOJKR6PG2VQOLWFQOF3X7XLOG',
        'GACXQEAXYBEZLBMQ2XETOBRO4P66FZAJENDHOQRYPUIXZIIXLKMZEXBJ',
        'GDD3XRXU3G4DXHVRUDH7LJM4CD4PDZTVP4QHOO4Q6DELKXUATR657OZV',
        'GDTYVCTAUQVPKEDZIBWEJGKBQHB4UGGXI2SXXUEW7LXMD4B7MK37CWLJ',
      ];
      for (const key of keys) {
        expect(StrKey.isValidEd25519PublicKey(key)).toBe(true);
      }
    });

    it('returns false for invalid public keys', () => {
      const keys = [
        'GBPXX0A5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVL',
        'GCFZB6L25D26RQFDWSSBDEYQ32JHLRMTT44ZYE3DZQUTYOL7WY43PLBG++',
        'GADE5QJ2TY7S5ZB65Q43DFGWYWCPHIYDJ2326KZGAGBN7AE5UY6JVDRRA',
        'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2',
        'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2T',
        'GDXIIZTKTLVYCBHURXL2UPMTYXOVNI7BRAEFQCP6EZCY4JLKY4VKFNLT',
        'SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY',
        'gWRYUerEKuz53tstxEuR3NCkiQDcV4wzFHmvLnZmj7PUqxW2wt',
        'test',
      ];
      for (const key of keys) {
        expect(StrKey.isValidEd25519PublicKey(key)).toBe(false);
      }
    });
  });

  describe('#isValidEd25519SecretSeed', () => {
    it('returns true for valid secret keys', () => {
      const keys = [
        'SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY',
        'SCZTUEKSEH2VYZQC6VLOTOM4ZDLMAGV4LUMH4AASZ4ORF27V2X64F2S2',
        'SCGNLQKTZ4XCDUGVIADRVOD4DEVNYZ5A7PGLIIZQGH7QEHK6DYODTFEH',
        'SDH6R7PMU4WIUEXSM66LFE4JCUHGYRTLTOXVUV5GUEPITQEO3INRLHER',
        'SC2RDTRNSHXJNCWEUVO7VGUSPNRAWFCQDPP6BGN4JFMWDSEZBRAPANYW',
        'SCEMFYOSFZ5MUXDKTLZ2GC5RTOJO6FGTAJCF3CCPZXSLXA2GX6QUYOA7',
      ];
      for (const key of keys) {
        expect(StrKey.isValidEd25519SecretSeed(key)).toBe(true);
      }
    });

    it('returns false for invalid secret keys', () => {
      const keys = [
        'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB',
        'SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDYT',
        'SAFGAMN5Z6IHVI3IVEPIILS7ITZDYSCEPLN4FN5Z3IY63DRH4CIYEV',
        'SAFGAMN5Z6IHVI3IVEPIILS7ITZDYSCEPLN4FN5Z3IY63DRH4CIYEVIT',
        'test',
      ];
      for (const key of keys) {
        expect(StrKey.isValidEd25519SecretSeed(key)).toBe(false);
      }
    });
  });

  describe('#muxedAccounts', () => {
    const PUBKEY = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
    const MPUBKEY =
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK';
    const RAW_MPUBKEY = fromHex(
      '3f0c34bf93ad0d9971d04ccc90f705511c838aad9734a4a2fb0d7a03fc7fe89a8000000000000000',
    );

    it('encodes & decodes M... addresses correctly', () => {
      const encoded = StrKey.encodeMed25519PublicKey(RAW_MPUBKEY);
      expect(encoded).toBe(MPUBKEY);
      const decoded = StrKey.decodeMed25519PublicKey(MPUBKEY);
      expect(toHex(decoded)).toBe(toHex(RAW_MPUBKEY));
    });

    it('validates M... addresses', () => {
      expect(StrKey.isValidMed25519PublicKey(MPUBKEY)).toBe(true);
      expect(StrKey.isValidMed25519PublicKey(PUBKEY)).toBe(false);
      expect(StrKey.isValidMed25519PublicKey('invalid')).toBe(false);
    });

    const MUXED_CASES = [
      {
        strkey:
          'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK',
        id: '9223372036854775808',
      },
      {
        strkey:
          'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAFB4CJJBRKA',
        id: '1357924680',
      },
      {
        strkey:
          'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAE2JUG6',
        id: '1234',
      },
      {
        strkey:
          'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
        id: '0',
      },
    ];

    for (const testCase of MUXED_CASES) {
      it(`roundtrips muxed key with ID=${testCase.id}`, () => {
        expect(StrKey.isValidMed25519PublicKey(testCase.strkey)).toBe(true);
        const decoded = StrKey.decodeMed25519PublicKey(testCase.strkey);
        const reEncoded = StrKey.encodeMed25519PublicKey(decoded);
        expect(reEncoded).toBe(testCase.strkey);
      });
    }
  });

  describe('#contracts', () => {
    it('decodes and re-encodes a C-address', () => {
      const strkey =
        'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
      const buf = StrKey.decodeContract(strkey);
      expect(toHex(buf)).toBe(
        '363eaa3867841fbad0f4ed88c779e4fe66e56a2470dc98c0ec9c073d05c7b103',
      );
      expect(StrKey.encodeContract(buf)).toBe(strkey);
    });

    it('validates contract addresses', () => {
      expect(
        StrKey.isValidContract(
          'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
        ),
      ).toBe(true);
      expect(
        StrKey.isValidContract(
          'GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
        ),
      ).toBe(false);
    });
  });

  describe('#preAuthTx', () => {
    it('validates pre-auth tx addresses', () => {
      const raw = new Uint8Array(32);
      raw[0] = 1;
      const encoded = StrKey.encodePreAuthTx(raw);
      expect(encoded).toMatch(/^T/);
      expect(StrKey.isValidPreAuthTx(encoded)).toBe(true);
      expect(StrKey.isValidPreAuthTx(PUBKEY1)).toBe(false);
    });
  });

  describe('#sha256Hash', () => {
    it('validates SHA256 hash addresses', () => {
      const raw = new Uint8Array(32);
      raw[0] = 1;
      const encoded = StrKey.encodeSha256Hash(raw);
      expect(encoded).toMatch(/^X/);
      expect(StrKey.isValidSha256Hash(encoded)).toBe(true);
      expect(StrKey.isValidSha256Hash(PUBKEY1)).toBe(false);
    });
  });

  describe('#signedPayloads', () => {
    it('validates signed payload addresses', () => {
      const raw = new Uint8Array(32);
      const encoded = StrKey.encodeSignedPayload(
        new Uint8Array([...raw, 0, 0, 0, 4, 1, 2, 3, 4]),
      );
      expect(encoded).toMatch(/^P/);
      expect(StrKey.isValidSignedPayload(encoded)).toBe(true);
      expect(StrKey.isValidSignedPayload(PUBKEY1)).toBe(false);
    });
  });

  describe('#invalidStrKeys (SEP-23)', () => {
    const BAD_STRKEYS = [
      // Unused trailing bit must be zero
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUR',
      // Invalid length (congruent to 1 mod 8)
      'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZA',
      // Invalid algorithm (low 3 bits of version byte are 7)
      'G47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVP2I',
      // Invalid length (congruent to 6 mod 8)
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLKA',
      // Invalid algorithm (low 3 bits of version byte are 7)
      'M47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
      // Padding bytes are not allowed
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUK===',
      // Invalid checksum
      'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUO',
    ];

    for (const address of BAD_STRKEYS) {
      it(`rejects invalid strkey: ${address.substring(0, 20)}...`, () => {
        // All of these should fail validation
        expect(StrKey.isValidEd25519PublicKey(address)).toBe(false);
        expect(StrKey.isValidEd25519SecretSeed(address)).toBe(false);
        expect(StrKey.isValidMed25519PublicKey(address)).toBe(false);
      });
    }
  });
});
