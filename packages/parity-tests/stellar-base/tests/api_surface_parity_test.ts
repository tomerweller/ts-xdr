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
// ---------------------------------------------------------------------------

// Top-level exports in official but intentionally absent from compat
const EXCLUDED_TOP_LEVEL = new Set([
  'default',         // CJS module artifact
  'TransactionBase', // merged into Transaction/FeeBumpTransaction
  'FastSigning',     // deprecated constant
]);

// Per-class method exclusions
const EXCLUDED_METHODS: Record<string, Set<string>> = {
  // getRawAssetType returns internal XDR enum; we use getAssetType() instead
  Asset: new Set(['getRawAssetType']),
  // toString not implemented; use contractId()
  Contract: new Set(['toString']),
  // getFootprint not implemented; use getReadOnly/getReadWrite
  SorobanDataBuilder: new Set(['getFootprint']),
  // XdrLargeInt: toTimepoint/toDuration are niche helpers; valueOf/toString/toJSON not overridden
  XdrLargeInt: new Set(['toTimepoint', 'toDuration', 'valueOf', 'toString', 'toJSON']),
};

// Per-class static exclusions
const EXCLUDED_STATICS: Record<string, Set<string>> = {
  // fromXDR not implemented on SorobanDataBuilder
  SorobanDataBuilder: new Set(['fromXDR']),
  // isType not implemented on XdrLargeInt
  XdrLargeInt: new Set(['isType']),
  // MIN/MAX_VALUE not implemented on large int subtypes
  Int128: new Set(['MIN_VALUE', 'MAX_VALUE']),
  Uint128: new Set(['MIN_VALUE', 'MAX_VALUE']),
  Int256: new Set(['MIN_VALUE', 'MAX_VALUE']),
  Uint256: new Set(['MIN_VALUE', 'MAX_VALUE']),
  // fromBits not implemented; use fromBigInt/fromString
  Hyper: new Set(['fromBits']),
  UnsignedHyper: new Set(['fromBits']),
};

// Per-class accessible property exclusions (own props + getters combined)
const EXCLUDED_ACCESSIBLE: Record<string, Set<string>> = {
  // sequence is accessed via sequenceNumber() method
  Account: new Set(['sequence']),
  // unsigned/size not tracked; Hyper is always signed, UnsignedHyper always unsigned
  Hyper: new Set(['unsigned', 'size']),
  UnsignedHyper: new Set(['unsigned', 'size']),
  // ScInt stores XdrLargeInt internally as `int`; compat uses different internal structure
  ScInt: new Set(['int']),
  // XdrLargeInt: type/unsigned/size metadata and int storage not exposed as properties
  XdrLargeInt: new Set(['type', 'unsigned', 'size', 'int']),
  // XdrLargeInt subtypes: unsigned/size are derivable from type
  Int128: new Set(['unsigned', 'size']),
  Uint128: new Set(['unsigned', 'size']),
  Int256: new Set(['unsigned', 'size']),
  Uint256: new Set(['unsigned', 'size']),
  // MuxedAccount.account is internal; use baseAccount() method
  MuxedAccount: new Set(['account']),
};

// Per-namespace member exclusions
const EXCLUDED_NS_MEMBERS: Record<string, Set<string>> = {
  // Internal helpers not part of public contract
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
