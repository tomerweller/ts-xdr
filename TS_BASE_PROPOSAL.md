# Migrating `js-stellar-base` to TypeScript

## Problem

`js-stellar-base` has two compounding problems: **bundle size** and an **unergonomic XDR API**.

### Bundle size

| Component | Raw Size | Notes |
|---|---|---|
| Generated XDR (`curr_generated.js`) | ~355 KB | **Not tree-shakeable** — monolithic `XDR.config()` |
| `@stellar/js-xdr` runtime | ~50-80 KB | Class-based XDR engine |
| `@noble/curves` (ed25519) | ~45 KB | Crypto (necessary) |
| `buffer` polyfill | ~25 KB | Browser Buffer shim |
| `bignumber.js` | ~20 KB | Amount arithmetic |
| Application source | ~80-100 KB | 35 hand-written JS files |
| `sha.js`, `base32.js`, polyfills | ~20-30 KB | Misc |

Root causes:
1. **No tree-shaking** — the generated XDR code registers all ~500 Stellar protocol types in a single imperative `XDR.config()` call. Importing one type pulls in every type.
2. **Not TypeScript** — 35 JS source files with hand-maintained `.d.ts` declarations (~1,350 lines) that drift from the implementation. No compile-time type safety.
3. **Babel + Webpack build** — CJS output for Node, UMD bundle for browser. No ESM entry point.
4. **Buffer dependency** — pervasive use of Node.js `Buffer` requires a ~25 KB polyfill in browsers.
5. **Redundant dependencies** — `sha.js` duplicates what `@noble/hashes` (transitive dep of `@noble/curves`) already provides. `bignumber.js` can be replaced with native `BigInt`.

### Unergonomic XDR API

`@stellar/js-xdr` uses a class-based, runtime-defined type system that predates modern TypeScript. Working with XDR types is verbose, opaque, and error-prone:

**Constructing values is ceremony-heavy:**
```javascript
// js-xdr: nested constructors, wrapper classes, factory methods
const tx = new xdr.TransactionSignaturePayload({
  networkId: xdr.Hash.fromXDR(hash(networkPassphrase)),
  taggedTransaction: new xdr.TransactionSignaturePayloadTaggedTransaction
    .envelopeTypeTx(innerTx),
});
```

**Accessing data requires method calls instead of property access:**
```javascript
// js-xdr: every field is a getter method, not a property
const fee = envelope.tx().fee().toString();
const source = envelope.tx().sourceAccount();
const ops = envelope.tx().operations();
```

**Enums and unions are opaque at the type level:**
```javascript
// js-xdr: factory methods return class instances; the type system can't narrow them
const asset = xdr.Asset.assetTypeCreditAlphanum4(alphaNum4);
asset.switch().name;    // 'assetTypeCreditAlphanum4' — runtime string, no type narrowing
asset.alphaNum4();      // works, but TypeScript can't verify this is safe
asset.alphaNum12();     // also compiles — throws at runtime
```

**64-bit integers require wrapper classes:**
```javascript
// js-xdr: Hyper class instead of native bigint
const fee = new xdr.Int64(Hyper.fromString('100'));
fee.toBigInt();         // extra conversion step
```

**No TypeScript type narrowing for unions:**
The hand-maintained `.d.ts` declarations (15,885 lines for XDR types alone, maintained via a separate `dts-stellar-xdr` tool) cannot express discriminated union narrowing. `switch(asset.switch().name)` gives `string`, not a narrowed literal type.

**ts-stellar-xdr solves all of these:**
```typescript
// Plain objects, direct property access, full type narrowing
const asset: Asset = { tag: 'CreditAlphanum4', value: { assetCode, issuer } };

const decoded = Asset.fromXdr(bytes);
switch (decoded.tag) {
  case 'Native': break;                           // TypeScript knows: no .value
  case 'CreditAlphanum4': decoded.value.assetCode; // TypeScript knows: AlphaNum4
}

// Native bigint, no wrapper classes
const fee: bigint = 100n;
```

## Goal

Rewrite `js-stellar-base` as a TypeScript-first, tree-shakeable library built on `ts-stellar-xdr`, while maintaining backward compatibility via a permanent compat layer for the js-xdr class-based API.

## Architecture

```
@stellar/stellar-base (new)
├── src/                            # TypeScript source
│   ├── index.ts                    # Main entry: tree-shakeable named exports
│   ├── compat/                     # Permanent backward-compat layer
│   │   ├── index.ts                # Entry: exports `xdr` namespace object
│   │   ├── runtime.ts              # Generic factories (createCompatStruct, etc.)
│   │   └── hyper.ts                # CompatHyper / CompatUnsignedHyper
│   ├── generated/
│   │   ├── stellar.ts              # ts-stellar-xdr types (from xdrgen, tree-shakeable)
│   │   └── stellar_compat.ts       # Compat wrappers (from xdrgen)
│   ├── keypair.ts, transaction.ts, asset.ts, ...  # Hand-written modules
│   └── ...
├── dist/                           # Build output
│   ├── esm/                        # ESM (primary)
│   └── cjs/                        # CJS (backward compat)
├── package.json                    # Dual ESM/CJS exports
└── tsconfig.json
```

### Package entry points

```jsonc
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs",
      "types": "./dist/esm/index.d.ts"
    },
    "./compat": {
      "import": "./dist/esm/compat/index.js",
      "require": "./dist/cjs/compat/index.cjs",
      "types": "./dist/esm/compat/index.d.ts"
    }
  }
}
```

Two entry points:
- **`@stellar/stellar-base`** — new API. Tree-shakeable named exports. Plain ts-stellar-xdr objects. `Uint8Array` everywhere.
- **`@stellar/stellar-base/compat`** — permanent backward-compat API. Exports the `xdr` namespace object with js-xdr-style classes, `Hyper`/`UnsignedHyper`, `Buffer`-based serialization.

---

## Dependency Changes

| Current | Replacement | Savings |
|---|---|---|
| `@stellar/js-xdr` (~50-80 KB) | `ts-stellar-xdr` (~8-10 KB, zero deps) | ~50 KB |
| `buffer` (~25 KB) | Native `Uint8Array` | ~25 KB (browser) |
| `bignumber.js` (~20 KB) | Native `BigInt` | ~20 KB |
| `sha.js` (~5 KB) | `@noble/hashes/sha256` (already bundled via `@noble/curves`) | ~5 KB |
| `base32.js` (~3 KB) | Keep or inline (~50 lines) | — |

**Remaining runtime dependencies:**
- `ts-stellar-xdr` — XDR codec engine
- `@noble/curves` — ed25519 (already the current choice, well-audited, TS-native)
- `@noble/hashes` — SHA-256 (transitive dep of `@noble/curves`, now used directly)

### Tree-shaking impact

The generated XDR goes from ~355 KB (all-or-nothing) to individually exported types. An app that only uses `Asset`, `TransactionEnvelope`, and `Memo` would pull in only those types and their transitive dependencies — likely 5-10 KB instead of 355 KB.

---

## Compat Layer Design

The compat layer is **permanent** and lives in `src/compat/`. It provides the exact js-xdr class-based API surface that existing `js-stellar-base` and `js-stellar-sdk` consumers depend on.

### What it reproduces

| js-xdr pattern | Compat implementation |
|---|---|
| `new Struct({ field: value })` | Constructor stores `_attributes`, getter/setter methods per field |
| `obj.field()` / `obj.field(newValue)` | Generated accessor methods that read/write `_attributes` |
| `EnumType.memberName()` → singleton | Factory methods returning cached instances with `.name`/`.value` |
| `Union.switchName(value)` | Factory methods per switch member |
| `.switch()` / `.arm()` / `.value()` | Methods on union instances |
| `.alphaNum4()` (arm-named accessors) | Generated per-arm accessor methods |
| `.toXDR(format?)` | Encodes via ts-stellar-xdr, converts to `Buffer`/base64/hex |
| `Type.fromXDR(input, format?)` | Parses input format, decodes via ts-stellar-xdr, wraps result |
| `Type.validateXDR(input, format?)` | Try/catch around `fromXDR`, returns boolean |
| `Type.isValid(value)` | Duck-typing check (structName/unionName/enumName) |
| `Hyper` / `UnsignedHyper` | Wrapper class around native `bigint` with `.toString()`, `.toBigInt()` |
| `xdr.Namespace.type` namespace | Single object with all types as properties |

### Generic factories

```typescript
// src/compat/runtime.ts

function createCompatStruct(
  name: string,
  fields: Array<[string, CompatCodec]>,
  tsCodec: XdrCodec<any>,
): CompatStructClass;

function createCompatEnum(
  name: string,
  members: Record<string, number>,       // legacyName → integer value
  tsNameMap: Record<string, string>,      // legacyName → ts-stellar-xdr name
  tsCodec: XdrCodec<any>,
): CompatEnumClass;

function createCompatUnion(
  name: string,
  switchType: CompatEnumClass,
  arms: Array<{ switches: string[]; armName: string; codec?: CompatCodec }>,
  defaultArm?: { codec?: CompatCodec },
  tsCodec: XdrCodec<any>,
): CompatUnionClass;
```

### Generated compat glue

The xdrgen TypeScript backend generates `stellar_compat.ts` alongside `stellar.ts`:

```typescript
// src/generated/stellar_compat.ts (generated)
import { createCompatStruct, createCompatEnum, createCompatUnion } from '../compat/runtime.js';
import * as ts from './stellar.js';

export const AssetType = createCompatEnum('AssetType', {
  assetTypeNative: 0,
  assetTypeCreditAlphanum4: 1,
  assetTypeCreditAlphanum12: 2,
  assetTypePoolShare: 3,
}, {
  assetTypeNative: 'Native',
  assetTypeCreditAlphanum4: 'CreditAlphanum4',
  assetTypeCreditAlphanum12: 'CreditAlphanum12',
  assetTypePoolShare: 'PoolShare',
}, ts.AssetType);

export const AlphaNum4 = createCompatStruct('AlphaNum4', [
  ['assetCode', opaqueCompat(4)],
  ['issuer', lazy(() => AccountId)],
], ts.AlphaNum4);

export const Asset = createCompatUnion('Asset', AssetType, [
  { switches: ['assetTypeNative'] },
  { switches: ['assetTypeCreditAlphanum4'], armName: 'alphaNum4', codec: lazy(() => AlphaNum4) },
  { switches: ['assetTypeCreditAlphanum12'], armName: 'alphaNum12', codec: lazy(() => AlphaNum12) },
], undefined, ts.Asset);

// ... all other Stellar types
```

### Recursive wrapping

Each compat codec wraps/unwraps nested values:

```typescript
interface CompatCodec<Plain = any, Compat = any> {
  wrap(plain: Plain): Compat;
  unwrap(compat: Compat): Plain;
}
```

- **Primitives** (int32, bool, etc.): identity
- **int64/uint64**: `bigint` ↔ `CompatHyper`/`CompatUnsignedHyper`
- **Structs**: recursively wrap/unwrap each field
- **Enums**: string literal ↔ enum singleton
- **Unions**: tagged object ↔ union class instance
- **Arrays**: recursively wrap/unwrap elements
- **Opaque/string**: identity (`Uint8Array`/`string`)

---

## TypeScript Migration: Hand-Written Modules

### Module conversion (35 files → TypeScript)

The existing JS modules are clean ES-module code with JSDoc comments. Conversion is mostly mechanical:
1. Rename `.js` → `.ts`
2. Add type annotations (guided by the existing `types/index.d.ts`)
3. Replace `Buffer` with `Uint8Array` in the public API
4. Replace `@stellar/js-xdr` imports with `ts-stellar-xdr` imports
5. Replace `bignumber.js` arithmetic with native `BigInt`
6. Replace `sha.js` with `@noble/hashes/sha256`

### `Buffer` → `Uint8Array`

This is the most pervasive change. Currently `Buffer` is used for:
- Key material (public keys, secret keys, signatures)
- XDR serialized output
- Hashes
- Opaque data (asset codes, memo values)

Strategy:
- Internal code uses `Uint8Array` exclusively
- The compat entry point re-wraps in `Buffer` where the old API returned `Buffer`
- Add a `toBuffer()` utility for consumers who need `Buffer` during migration

### Amount arithmetic

Currently uses `bignumber.js` for Stellar's 7-decimal fixed-point amounts (stored as int64 stroops). Replace with:

```typescript
const STROOP_FACTOR = 10_000_000n;

function toStroops(amount: string): bigint {
  // Parse "123.4567890" → 1234567890n
  // Validate exactly 7 decimal places max
}

function fromStroops(stroops: bigint): string {
  // 1234567890n → "123.4567890"
}
```

This eliminates the `bignumber.js` dependency (~20 KB) with ~30 lines of code.

### Hashing

Replace:
```javascript
import createHash from 'sha.js';
export function hash(data) { return createHash('sha256').update(data).digest(); }
```

With:
```typescript
import { sha256 } from '@noble/hashes/sha256';
export function hash(data: Uint8Array): Uint8Array { return sha256(data); }
```

`@noble/hashes` is already a transitive dependency of `@noble/curves`, so this adds zero bundle weight.

### Key management (`keypair.ts`)

Already uses `@noble/curves/ed25519` — mostly needs type annotations and `Buffer` → `Uint8Array`.

### StrKey (`strkey.ts`)

Uses `base32.js` for encoding. Options:
1. Keep `base32.js` (3 KB, minimal)
2. Inline a base32 implementation (~50 lines)

Either is fine. Low priority.

---

## Build System

### Current: Babel + Webpack
- `babel` → `lib/` (CJS for Node)
- `webpack` → `dist/` (UMD bundle for browser)
- Hand-maintained `.d.ts` files
- No ESM output

### New: TypeScript compiler + bundler

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist/esm",
    "rootDir": "src",
    "strict": true
  }
}
```

Build pipeline:
1. `tsc` → `dist/esm/` (ESM + `.d.ts` declarations)
2. Post-process for CJS: `tsc -p tsconfig.cjs.json` → `dist/cjs/` (or use a tool like `tsup`)
3. No more UMD browser bundle — ESM works in all modern bundlers (Vite, webpack 5, esbuild, Rollup)
4. No more hand-maintained `.d.ts` — generated from source
5. No more `node-polyfill-webpack-plugin` — no Node builtins needed

### Drop the browser UMD bundle?

The UMD bundle (`dist/stellar-base.js`) exists for `<script>` tag usage. Modern consumers use bundlers. Options:
1. **Drop it** — breaking for anyone using `<script src="stellar-base.js">`, but this is rare
2. **Keep it via a simple esbuild step** — `esbuild src/compat/index.ts --bundle --format=iife --global-name=StellarBase`
3. **Offer a CDN ESM build** — `<script type="module">import { ... } from 'https://esm.sh/@stellar/stellar-base'</script>`

Recommend option 2 for backward compatibility, generated from the compat entry point.

---

## Test Migration

### Current: Mocha + Chai + Sinon (29 test files)
### Target: Vitest

Vitest is API-compatible with Jest and supports TypeScript natively. Migration:
1. Replace `expect` from Chai with Vitest's built-in `expect` (largely compatible)
2. Replace `sinon` with `vi.fn()` / `vi.spyOn()`
3. Rename `.js` → `.ts`
4. Drop `@babel/register` — Vitest handles TS natively
5. Drop Karma browser tests — Vitest can run in browser mode if needed

The existing tests serve as the **acceptance criteria** — the migrated code must pass all existing test cases (adapted for the new API where needed). The compat layer tests must pass the existing tests **unchanged** (modulo import paths).

---

## Migration Phases

### Phase 1: ts-stellar-xdr completion
**Status: mostly done (this repo)**
- [x] Core runtime (reader, writer, codecs)
- [x] All tests passing
- [x] Rust compatibility tests
- [ ] xdrgen TypeScript backend (generator/typescript.rb)
- [ ] xdrgen compat backend (generate `stellar_compat.ts`)

### Phase 2: Compat runtime
Build the generic compat factories in isolation (can live in this repo initially, move to js-stellar-base later):
- [ ] `createCompatStruct` with getter/setter methods
- [ ] `createCompatEnum` with factory methods and singletons
- [ ] `createCompatUnion` with `.switch()`, `.arm()`, `.value()`, arm-named accessors
- [ ] `CompatHyper` / `CompatUnsignedHyper`
- [ ] Recursive wrap/unwrap
- [ ] `toXDR(format?)` / `fromXDR(input, format?)` / `validateXDR(input, format?)`
- [ ] Test suite: verify compat types match js-xdr behavior for all patterns found in js-stellar-base

### Phase 3: Fork and convert js-stellar-base
Create `ts-stellar-base` (or a branch of `js-stellar-base`):
- [ ] Set up TypeScript build (tsc, dual ESM/CJS output)
- [ ] Set up Vitest
- [ ] Convert source files to TypeScript (mechanical: types, Uint8Array, BigInt, imports)
- [ ] Replace `@stellar/js-xdr` + `curr_generated.js` with `ts-stellar-xdr` + `stellar.ts`
- [ ] Wire up compat entry point (`/compat` exports `xdr` namespace)
- [ ] Replace `bignumber.js` with native BigInt stroop arithmetic
- [ ] Replace `sha.js` with `@noble/hashes/sha256`
- [ ] Port all 29 test files to Vitest + TypeScript
- [ ] Verify all tests pass
- [ ] Verify compat entry point passes original test suite (with minimal import-path changes)

### Phase 4: js-stellar-sdk integration
- [ ] Update `js-stellar-sdk` to use new `@stellar/stellar-base`
- [ ] SDK re-exports compat entry point for backward compatibility
- [ ] SDK internal code migrates to new API
- [ ] Run full SDK test suite

### Phase 5: Ecosystem rollout
- [ ] Publish `ts-stellar-xdr` to npm
- [ ] Publish updated `@stellar/stellar-base` (major version bump)
- [ ] Migration guide for downstream consumers
- [ ] Deprecation timeline for compat entry point (if ever)

---

## Expected Bundle Size (new API)

| Component | Size (est.) | Notes |
|---|---|---|
| ts-stellar-xdr runtime | ~8 KB | Zero deps, minimal |
| XDR types (tree-shaken) | ~10-50 KB | Depends on what's imported (vs 355 KB today) |
| `@noble/curves` | ~45 KB | Unchanged |
| Application source | ~60-80 KB | TypeScript, no polyfills |
| **Total (min+gz, typical app)** | **~40-60 KB** | **vs ~200+ KB today** |

For the compat entry point (non-tree-shakeable, all types), expect ~150-200 KB — still an improvement due to dropping js-xdr runtime, buffer polyfill, and bignumber.js.

---

## Open Questions

1. **Package name**: Keep `@stellar/stellar-base` (major version bump) or new package `@stellar/stellar-base-v2`?

2. **`curr` vs `next` XDR**: Currently both `curr_generated.js` and `next_generated.js` are generated. `next` is for pre-release protocol testing. Should we keep this pattern? It doubles the generated code.

3. **StrKey base32**: Keep `base32.js` or inline? Low stakes either way.

4. **Browser UMD**: Drop it, keep it via esbuild, or offer ESM-only CDN alternative?

5. **Compat layer scope**: Should the compat entry point also wrap the non-XDR classes (`Keypair`, `Transaction`, `Asset`, etc.) to maintain exact API parity? Or only the `xdr` namespace?
