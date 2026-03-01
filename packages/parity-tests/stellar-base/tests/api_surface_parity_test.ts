import { describe, it, expect } from 'vitest';
import * as OfficialBase from '@stellar/stellar-base';
import * as CompatBase from '@stellar/stellar-base-comp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Public methods on prototype (excludes getters, _-prefixed, constructor) */
function getPrototypeMethods(cls: any): string[] {
  if (!cls?.prototype) return [];
  return Object.getOwnPropertyNames(cls.prototype).filter((n) => {
    if (n === 'constructor' || n.startsWith('_')) return false;
    // Use descriptor to avoid triggering getters
    const desc = Object.getOwnPropertyDescriptor(cls.prototype, n);
    return desc && typeof desc.value === 'function';
  });
}

/** Getter properties on prototype (excludes _-prefixed) */
function getPrototypeGetters(cls: any): string[] {
  if (!cls?.prototype) return [];
  const descs = Object.getOwnPropertyDescriptors(cls.prototype);
  return Object.entries(descs)
    .filter(([n, d]) => !n.startsWith('_') && n !== 'constructor' && typeof d.get === 'function')
    .map(([n]) => n);
}

/** Static members on constructor (excludes builtins, _-prefixed) */
function getStaticMembers(cls: any): string[] {
  const builtins = new Set(['length', 'name', 'prototype', 'arguments', 'caller']);
  return Object.getOwnPropertyNames(cls).filter(
    (n) => !builtins.has(n) && !n.startsWith('_'),
  );
}

/**
 * All public property names accessible on an instance, either as:
 * - Own properties set in the constructor, OR
 * - Getters defined on the prototype
 *
 * This combined check avoids false positives when one implementation uses
 * own properties (this.x = ...) and the other uses prototype getters.
 */
function getAccessibleProperties(instance: any, cls: any): string[] {
  const ownProps = instance
    ? Object.getOwnPropertyNames(instance).filter((n) => !n.startsWith('_'))
    : [];
  const protoGetters = getPrototypeGetters(cls);
  return [...new Set([...ownProps, ...protoGetters])];
}

// ---------------------------------------------------------------------------
// Factory registry — creates minimal instances for property inspection
// ---------------------------------------------------------------------------

const PUBKEY = 'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC';
const POOL_ID_HEX = 'a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0';
const CONTRACT_ADDR = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

type FactoryFn = (lib: any) => any;

const factories: Record<string, FactoryFn> = {
  Asset: (lib) => new lib.Asset('USD', PUBKEY),
  Memo: (lib) => new lib.Memo('text', 'hello'),
  Account: (lib) => new lib.Account(PUBKEY, '1'),
  Keypair: (lib) => lib.Keypair.random(),
  LiquidityPoolAsset: (lib) => {
    const a = new lib.Asset('ARST', 'GB7TAYRUZGE6TVT7NHP5SMIZRNQA6PLM423EYISAOAP3MKYIQMVYP2JO');
    const b = new lib.Asset('USD', 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ');
    return new lib.LiquidityPoolAsset(a, b, lib.LiquidityPoolFeeV18);
  },
  LiquidityPoolId: (lib) => new lib.LiquidityPoolId(POOL_ID_HEX),
  Claimant: (lib) => new lib.Claimant(PUBKEY),
  Contract: (lib) => new lib.Contract(CONTRACT_ADDR),
  Address: (lib) => new lib.Address(PUBKEY),
  SorobanDataBuilder: (lib) => new lib.SorobanDataBuilder(),
  ScInt: (lib) => new lib.ScInt(42),
  XdrLargeInt: (lib) => new lib.XdrLargeInt('u64', 42),
  Int128: (lib) => new lib.Int128(0n),
  Uint128: (lib) => new lib.Uint128(0n),
  Int256: (lib) => new lib.Int256(0n),
  Uint256: (lib) => new lib.Uint256(0n),
  Hyper: (lib) => new lib.Hyper(0, 0),
  UnsignedHyper: (lib) => new lib.UnsignedHyper(0, 0),
  MuxedAccount: (lib) => {
    const acct = new lib.Account(PUBKEY, '1');
    return new lib.MuxedAccount(acct, '0');
  },
};

// ---------------------------------------------------------------------------
// Known exclusions — intentional differences we allowlist
//
// Each entry includes a justification from a full audit against the official
// @stellar/stellar-base source code.
// ---------------------------------------------------------------------------

// Top-level exports in official but intentionally absent from compat
const EXCLUDED_TOP_LEVEL = new Set([
  // CJS module.exports artifact — not functional API, ESM consumers never use this
  'default',
  // Merged into Transaction/FeeBumpTransaction — both compat classes inherit all
  // TransactionBase methods directly; no consumer imports TransactionBase standalone
  'TransactionBase',
  // Deprecated constant (always true) — we use @noble/ed25519 which is always fast;
  // exposing a constant `true` has no value
  'FastSigning',
]);

// Per-class method exclusions
const EXCLUDED_METHODS: Record<string, Set<string>> = {
  // Returns raw xdr.AssetType enum object — only called internally by Asset itself
  // (in getAssetType() implementation). Consumers use getAssetType() which returns
  // readable strings ('native', 'credit_alphanum4', 'credit_alphanum12')
  Asset: new Set(['getRawAssetType']),
  // Returns { readOnly, readWrite } footprint object — consumers use getReadOnly()
  // and getReadWrite() which return the same data via separate calls
  SorobanDataBuilder: new Set(['getFootprint']),
  // Returns the underlying Hyper/Int128/etc valueOf — niche JS protocol override
  // with no known consumer usage for XdrLargeInt specifically
  XdrLargeInt: new Set(['valueOf']),
};

// Per-class static exclusions
const EXCLUDED_STATICS: Record<string, Set<string>> = {
  // Static factory that decodes XDR — the constructor already accepts base64
  // strings; alternate entry point, not a unique capability
  SorobanDataBuilder: new Set(['fromXDR']),
  // Static validation: isType('u64') → true — niche utility for type-string
  // validation with no known consumer usage
  XdrLargeInt: new Set(['isType']),
  // Range constants on large-int subclasses — these classes are internal to the
  // SDK's XdrLargeInt hierarchy; consumers interact via XdrLargeInt or ScInt,
  // not these subclasses directly (note: Int256 already has them in our impl)
  Int128: new Set(['MIN_VALUE', 'MAX_VALUE']),
  Uint128: new Set(['MIN_VALUE', 'MAX_VALUE']),
  // Int256 already has these in our impl, but kept for consistency
  Int256: new Set(['MIN_VALUE', 'MAX_VALUE']),
  Uint256: new Set(['MIN_VALUE', 'MAX_VALUE']),
  // Static factory from (low, high) int32 pair — the constructor already accepts
  // new Hyper(low, high) with identical semantics; redundant entry point
  Hyper: new Set(['fromBits']),
  UnsignedHyper: new Set(['fromBits']),
};

// Per-class accessible property exclusions (own props + getters combined)
const EXCLUDED_ACCESSIBLE: Record<string, Set<string>> = {
  // Official exposes as a BigNumber own property — our compat stores a bigint
  // internally and exposes via sequenceNumber(): string. Even if we exposed it,
  // the type difference (BigNumber → bigint) means code doing
  // account.sequence.plus(1) would break anyway
  Account: new Set(['sequence']),
  // Boolean indicating signedness — redundant: Hyper is always signed,
  // UnsignedHyper always unsigned (the type itself conveys this).
  // .size is always 64 — internal metadata with no practical use
  Hyper: new Set(['unsigned', 'size']),
  UnsignedHyper: new Set(['unsigned', 'size']),
  // Same as Hyper: type-level metadata, internal to large-int hierarchy
  Int128: new Set(['unsigned', 'size']),
  Uint128: new Set(['unsigned', 'size']),
  Int256: new Set(['unsigned', 'size']),
  Uint256: new Set(['unsigned', 'size']),
  // Direct reference to inner Account object — use baseAccount() method instead
  // (identical semantics, cleaner API)
  MuxedAccount: new Set(['account']),
};

// Per-namespace member exclusions
const EXCLUDED_NS_MEMBERS: Record<string, Set<string>> = {
  // Pure internal helpers — setSourceAccount mutates an opAttributes object during
  // operation construction; constructAmountRequirementsError builds a validation
  // error string. Neither is part of the public API contract
  Operation: new Set(['setSourceAccount', 'constructAmountRequirementsError']),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Surface Parity', () => {
  // ---- Top-level exports ----

  it('exports all official top-level names', () => {
    const officialNames = Object.keys(OfficialBase).filter(
      (n) => !n.startsWith('_') && !EXCLUDED_TOP_LEVEL.has(n),
    );
    const compatNames = new Set(Object.keys(CompatBase));

    const missing = officialNames.filter((n) => !compatNames.has(n));
    expect(missing, `Missing top-level exports: ${missing.join(', ')}`).toEqual([]);
  });

  // ---- Classes ----

  const classNames = Object.keys(factories);

  for (const className of classNames) {
    describe(className, () => {
      const officialCls = (OfficialBase as any)[className];
      const compatCls = (CompatBase as any)[className];

      if (!officialCls || !compatCls) {
        it.skip(`${className} not found in both packages`, () => {});
        return;
      }

      it('has all official prototype methods', () => {
        const officialMethods = getPrototypeMethods(officialCls);
        const compatMethods = new Set(getPrototypeMethods(compatCls));
        const excluded = EXCLUDED_METHODS[className] ?? new Set();

        const missing = officialMethods.filter(
          (m) => !compatMethods.has(m) && !excluded.has(m),
        );
        expect(missing, `${className} missing methods: ${missing.join(', ')}`).toEqual([]);
      });

      it('has all official static members', () => {
        const officialStatics = getStaticMembers(officialCls);
        const compatStatics = new Set(getStaticMembers(compatCls));
        const excluded = EXCLUDED_STATICS[className] ?? new Set();

        const missing = officialStatics.filter(
          (s) => !compatStatics.has(s) && !excluded.has(s),
        );
        expect(missing, `${className} missing statics: ${missing.join(', ')}`).toEqual([]);
      });

      it('has all official accessible properties', () => {
        const factory = factories[className];
        let officialInstance: any;
        let compatInstance: any;
        try {
          officialInstance = factory(OfficialBase);
        } catch {
          return; // skip if official can't instantiate
        }
        try {
          compatInstance = factory(CompatBase);
        } catch (e: any) {
          throw new Error(`${className}: compat factory failed: ${e.message}`);
        }

        const officialProps = getAccessibleProperties(officialInstance, officialCls);
        const compatProps = new Set(getAccessibleProperties(compatInstance, compatCls));
        const excluded = EXCLUDED_ACCESSIBLE[className] ?? new Set();

        const missing = officialProps.filter(
          (p) => !compatProps.has(p) && !excluded.has(p),
        );
        expect(missing, `${className} missing accessible props: ${missing.join(', ')}`).toEqual([]);
      });
    });
  }

  // ---- Namespaces ----

  const namespaces = ['StrKey', 'Operation', 'SignerKey', 'Soroban'];

  for (const nsName of namespaces) {
    describe(nsName, () => {
      const officialNs = (OfficialBase as any)[nsName];
      const compatNs = (CompatBase as any)[nsName];

      if (!officialNs || !compatNs) {
        it.skip(`${nsName} not found in both packages`, () => {});
        return;
      }

      it('has all official members', () => {
        const officialMembers = Object.getOwnPropertyNames(officialNs).filter(
          (n) =>
            !n.startsWith('_') &&
            !['length', 'name', 'prototype', 'arguments', 'caller'].includes(n),
        );
        const compatMembers = new Set(
          Object.getOwnPropertyNames(compatNs).filter(
            (n) => !['length', 'name', 'prototype', 'arguments', 'caller'].includes(n),
          ),
        );
        const excluded = EXCLUDED_NS_MEMBERS[nsName] ?? new Set();

        const missing = officialMembers.filter(
          (m) => !compatMembers.has(m) && !excluded.has(m),
        );
        expect(missing, `${nsName} missing members: ${missing.join(', ')}`).toEqual([]);
      });
    });
  }
});
