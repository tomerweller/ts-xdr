import { describe, it, expect } from 'vitest';
import { Keypair } from '../src/keypair.js';
import { StrKey } from '../src/strkey.js';

const SECRET1 = 'SDL2ENWLAB7NHNVZUWTSZO23D3YLF4YUKUBHLWDVHKNDFJ37VDQ2RI53';
const PUBKEY1 = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Keypair.fromSecret', () => {
  it('creates a keypair correctly', () => {
    const secret = 'SD7X7LEHBNMUIKQGKPARG5TDJNBHKC346OUARHGZL5ITC6IJPXHILY36';
    const kp = Keypair.fromSecret(secret);
    expect(kp.publicKey()).toBe(
      'GDFQVQCYYB7GKCGSCUSIQYXTPLV5YJ3XWDMWGQMDNM4EAXAL7LITIBQ7',
    );
    expect(kp.secret()).toBe(secret);
  });

  it('creates from secret', () => {
    const kp = Keypair.fromSecret(SECRET1);
    expect(kp.publicKey()).toBe(PUBKEY1);
    expect(kp.secret()).toBe(SECRET1);
    expect(kp.canSign()).toBe(true);
  });

  it("throws when arg isn't strkey-encoded as a seed", () => {
    expect(() => Keypair.fromSecret('hel0')).toThrow();
    expect(() =>
      Keypair.fromSecret(
        'SBWUBZ3SIPLLF5CCXLWUB2Z6UBTYAW34KVXOLRQ5HDAZG4ZY7MHNBWJ1',
      ),
    ).toThrow();
    expect(() =>
      Keypair.fromSecret('masterpassphrasemasterpassphrase'),
    ).toThrow();
    expect(() =>
      Keypair.fromSecret(
        'gsYRSEQhTffqA9opPepAENCr2WG6z5iBHHubxxbRzWaHf8FBWcu',
      ),
    ).toThrow();
  });
});

describe('Keypair.fromRawEd25519Seed', () => {
  it('creates a keypair correctly', () => {
    const seed = new TextEncoder().encode('masterpassphrasemasterpassphrase');
    const kp = Keypair.fromRawEd25519Seed(seed);
    expect(kp.publicKey()).toBe(
      'GAXDYNIBA5E4DXR5TJN522RRYESFQ5UNUXHIPTFGVLLD5O5K552DF5ZH',
    );
    expect(kp.secret()).toBe(
      'SBWWC43UMVZHAYLTONYGQ4TBONSW2YLTORSXE4DBONZXA2DSMFZWLP2R',
    );
    expect(toHex(kp.rawPublicKey())).toBe(
      '2e3c35010749c1de3d9a5bdd6a31c12458768da5ce87cca6aad63ebbaaef7432',
    );
  });

  it("throws when arg isn't 32 bytes", () => {
    expect(() =>
      Keypair.fromRawEd25519Seed(
        new TextEncoder().encode('masterpassphrasemasterpassphras'),
      ),
    ).toThrow();
    expect(() =>
      Keypair.fromRawEd25519Seed(
        new TextEncoder().encode('masterpassphrasemasterpassphrase1'),
      ),
    ).toThrow();
  });
});

describe('Keypair.fromPublicKey', () => {
  it('creates a keypair correctly', () => {
    const kp = Keypair.fromPublicKey(
      'GAXDYNIBA5E4DXR5TJN522RRYESFQ5UNUXHIPTFGVLLD5O5K552DF5ZH',
    );
    expect(kp.publicKey()).toBe(
      'GAXDYNIBA5E4DXR5TJN522RRYESFQ5UNUXHIPTFGVLLD5O5K552DF5ZH',
    );
    expect(toHex(kp.rawPublicKey())).toBe(
      '2e3c35010749c1de3d9a5bdd6a31c12458768da5ce87cca6aad63ebbaaef7432',
    );
  });

  it('creates from public key (no signing ability)', () => {
    const kp = Keypair.fromPublicKey(PUBKEY1);
    expect(kp.publicKey()).toBe(PUBKEY1);
    expect(kp.canSign()).toBe(false);
    expect(() => kp.secret()).toThrow();
  });

  it("throws when arg isn't strkey-encoded as accountid", () => {
    expect(() => Keypair.fromPublicKey('hel0')).toThrow();
    expect(() =>
      Keypair.fromPublicKey('masterpassphrasemasterpassphrase'),
    ).toThrow();
    expect(() =>
      Keypair.fromPublicKey(
        'sfyjodTxbwLtRToZvi6yQ1KnpZriwTJ7n6nrASFR6goRviCU3Ff',
      ),
    ).toThrow();
  });
});

describe('Keypair.fromRawPublicKey', () => {
  it('creates a keypair correctly', () => {
    const raw = StrKey.decodeEd25519PublicKey(PUBKEY1);
    const kp = Keypair.fromRawPublicKey(raw);
    expect(kp.publicKey()).toBe(PUBKEY1);
    expect(kp.canSign()).toBe(false);
  });

  it('throws when wrong length', () => {
    expect(() => Keypair.fromRawPublicKey(new Uint8Array(31))).toThrow();
    expect(() => Keypair.fromRawPublicKey(new Uint8Array(33))).toThrow();
  });
});

describe('Keypair.random', () => {
  it('generates random keypair', () => {
    const kp = Keypair.random();
    expect(kp.canSign()).toBe(true);
    expect(kp.publicKey()).toMatch(/^G/);
    expect(kp.secret()).toMatch(/^S/);
  });

  it('generates unique keypairs', () => {
    const kp1 = Keypair.random();
    const kp2 = Keypair.random();
    expect(kp1.publicKey()).not.toBe(kp2.publicKey());
  });
});

describe('Keypair.rawPublicKey / rawSecretKey', () => {
  it('rawPublicKey returns 32 bytes', () => {
    const kp = Keypair.fromSecret(SECRET1);
    expect(kp.rawPublicKey()).toBeInstanceOf(Uint8Array);
    expect(kp.rawPublicKey().length).toBe(32);
  });

  it('rawSecretKey returns 32 bytes', () => {
    const kp = Keypair.fromSecret(SECRET1);
    expect(kp.rawSecretKey()).toBeInstanceOf(Uint8Array);
    expect(kp.rawSecretKey().length).toBe(32);
  });

  it('rawSecretKey throws for public-only keypair', () => {
    const kp = Keypair.fromPublicKey(PUBKEY1);
    expect(() => kp.rawSecretKey()).toThrow();
  });
});

describe('Keypair.sign and verify', () => {
  it('signs and verifies synchronously', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const data = new Uint8Array([1, 2, 3, 4]);
    const sig = kp.sign(data);
    expect(sig).toBeInstanceOf(Uint8Array);
    expect(sig.length).toBe(64);
    expect(kp.verify(data, sig)).toBe(true);
  });

  it('rejects corrupted data', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const data = new Uint8Array([1, 2, 3, 4]);
    const sig = kp.sign(data);
    const corrupted = new Uint8Array([5, 6, 7, 8]);
    expect(kp.verify(corrupted, sig)).toBe(false);
  });

  it('rejects bad signature', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const data = new Uint8Array([1, 2, 3, 4]);
    const badSig = new Uint8Array(64);
    expect(kp.verify(data, badSig)).toBe(false);
  });

  it('throws when trying to sign without secret key', () => {
    const kp = Keypair.fromPublicKey(PUBKEY1);
    expect(() => kp.sign(new Uint8Array([1]))).toThrow();
  });

  it('verifies with public-key-only keypair', () => {
    const secretKp = Keypair.fromSecret(SECRET1);
    const publicKp = Keypair.fromPublicKey(PUBKEY1);
    const data = new Uint8Array([10, 20, 30]);
    const sig = secretKp.sign(data);
    expect(publicKp.verify(data, sig)).toBe(true);
  });
});

describe('Keypair.signDecorated', () => {
  it('returns hint and signature', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const data = new Uint8Array([5, 6, 7, 8]);
    const dec = kp.signDecorated(data);
    expect(dec.hint).toBeInstanceOf(Uint8Array);
    expect(dec.hint.length).toBe(4);
    expect(dec.signature).toBeInstanceOf(Uint8Array);
    expect(dec.signature.length).toBe(64);
  });

  it('hint matches signatureHint', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const data = new Uint8Array([1, 2, 3]);
    const dec = kp.signDecorated(data);
    expect(dec.hint).toEqual(kp.signatureHint());
  });

  it('hint matches last 4 bytes of public key', () => {
    const secret = 'SDVSYBKP7ESCODJSNGVDNXAJB63NPS5GQXSBZXLNT2Y4YVUJCFZWODGJ';
    const kp = Keypair.fromSecret(secret);
    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const dec = kp.signDecorated(data);
    const expectedHint = kp.rawPublicKey().slice(-4);
    expect(Array.from(dec.hint)).toEqual(Array.from(expectedHint));
  });
});

describe('Keypair.signatureHint', () => {
  it('returns last 4 bytes of public key', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const hint = kp.signatureHint();
    const raw = kp.rawPublicKey();
    expect(hint).toEqual(raw.slice(-4));
  });

  it('returns 4 bytes', () => {
    const kp = Keypair.random();
    expect(kp.signatureHint().length).toBe(4);
  });
});

describe('Keypair.xdrMuxedAccount', () => {
  it('returns a valid MuxedAccount with Ed25519 key type', () => {
    const kp = Keypair.fromPublicKey(
      'GAXDYNIBA5E4DXR5TJN522RRYESFQ5UNUXHIPTFGVLLD5O5K552DF5ZH',
    );
    const muxed = kp.xdrMuxedAccount();
    expect(muxed).toBeDefined();
    // Compat union: .switch() returns enum, .ed25519() returns raw key
    expect(muxed.switch().name).toBe('keyTypeEd25519');
    expect(muxed.ed25519()).toBeInstanceOf(Uint8Array);
  });
});

describe('Keypair.xdrPublicKey', () => {
  it('returns a valid PublicKey', () => {
    const kp = Keypair.fromSecret(SECRET1);
    const pk = kp.xdrPublicKey();
    expect(pk).toBeDefined();
    expect(pk.switch().name).toBe('publicKeyTypeEd25519');
    expect(pk.ed25519()).toBeInstanceOf(Uint8Array);
  });
});
