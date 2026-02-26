# `ts-stellar-xdr` — TypeScript XDR Library Specification

## Context

Stellar needs a modern, TypeScript-first XDR library to replace the aging `@stellar/js-xdr` (runtime class-based, no TypeScript types). This spec defines `ts-stellar-xdr`: a generic RFC 4506 XDR codec library that will serve as the foundation for a new TypeScript Stellar SDK. The design is inspired by `rs-stellar-xdr` (Rust) but tailored to TypeScript idioms.

### Design Decisions (Confirmed)

| Decision | Choice |
|---|---|
| Type generation | Code-generated from `.x` files |
| Generator tool | New TypeScript backend for `stellar/xdrgen` (Ruby) |
| Scope | Generic XDR only (pure RFC 4506) |
| Formats | XDR binary + Base64 |
| Union representation | Tagged objects `{ tag, value? }` |
| 64-bit integers | Native `BigInt` only |
| Generated output | Single `.ts` file |

---

## 1. Package Architecture

### 1.1 npm package: `ts-stellar-xdr`

```
ts-stellar-xdr/
  src/
    index.ts          # Public API re-exports
    reader.ts         # XdrReader class
    writer.ts         # XdrWriter class
    codec.ts          # XdrCodec<T> interface, BaseCodec abstract class
    primitives.ts     # int32, uint32, int64, uint64, float32, float64, bool, xdrVoid
    containers.ts     # fixedOpaque, varOpaque, xdrString, fixedArray, varArray, option
    composites.ts     # xdrStruct, xdrEnum, taggedUnion
    limits.ts         # Limits interface, LimitTracker
    errors.ts         # XdrError class + error codes
    base64.ts         # encodeBase64 / decodeBase64
  tests/
    reader.test.ts
    writer.test.ts
    primitives.test.ts
    containers.test.ts
    composites.test.ts
    integration.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
```

### 1.2 xdrgen backend: `lib/xdrgen/generators/typescript.rb`

A single Ruby file added to `stellar/xdrgen`, inheriting from `Xdrgen::Generators::Base`. Outputs a single `{namespace}_generated.ts` file. Generated code imports from `ts-stellar-xdr`.

---

## 2. XDR Type Mapping

| XDR Type | TypeScript Type | Codec Expression |
|---|---|---|
| `int` | `number` | `int32` |
| `unsigned int` | `number` | `uint32` |
| `hyper` | `bigint` | `int64` |
| `unsigned hyper` | `bigint` | `uint64` |
| `float` | `number` | `float32` |
| `double` | `number` | `float64` |
| `bool` | `boolean` | `bool` |
| `void` | `void` | `xdrVoid` |
| `opaque[N]` | `Uint8Array` | `fixedOpaque(N)` |
| `opaque<N>` | `Uint8Array` | `varOpaque(N)` |
| `string<N>` | `string` | `xdrString(N)` |
| `T[N]` | `readonly T[]` | `fixedArray(N, TCodec)` |
| `T<N>` | `readonly T[]` | `varArray(N, TCodec)` |
| `T*` | `T \| undefined` | `option(TCodec)` |
| `struct` | `interface` | `xdrStruct([...fields])` |
| `enum` | const object + string literal union | `xdrEnum({...})` |
| `union` | tagged discriminated union | `taggedUnion({...})` |
| `typedef` | type alias + codec constant | depends on underlying type |

---

## 3. Public API Surface

### 3.1 Errors (`src/errors.ts`)

```typescript
export const XdrErrorCode = {
  InvalidValue: 'INVALID_VALUE',
  LengthExceedsMax: 'LENGTH_EXCEEDS_MAX',
  LengthMismatch: 'LENGTH_MISMATCH',
  NonZeroPadding: 'NON_ZERO_PADDING',
  BufferUnderflow: 'BUFFER_UNDERFLOW',
  BufferNotFullyConsumed: 'BUFFER_NOT_FULLY_CONSUMED',
  DepthLimitExceeded: 'DEPTH_LIMIT_EXCEEDED',
  ByteLimitExceeded: 'BYTE_LIMIT_EXCEEDED',
  InvalidEnumValue: 'INVALID_ENUM_VALUE',
  InvalidUnionDiscriminant: 'INVALID_UNION_DISCRIMINANT',
  Utf8Error: 'UTF8_ERROR',
} as const;

export type XdrErrorCode = typeof XdrErrorCode[keyof typeof XdrErrorCode];

export class XdrError extends Error {
  readonly code: XdrErrorCode;
  constructor(code: XdrErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'XdrError';
    this.code = code;
  }
}
```

### 3.2 Limits (`src/limits.ts`)

```typescript
export interface Limits {
  readonly depth: number;  // Max recursion depth
  readonly len: number;    // Max total bytes
}

export const DEFAULT_LIMITS: Limits = { depth: 512, len: 256 * 1024 * 1024 };

export class LimitTracker {
  constructor(limits: Limits);
  consumeLen(n: number): void;   // Throws ByteLimitExceeded
  withDepth<T>(fn: () => T): T;  // Enter/exit depth, throws DepthLimitExceeded
}
```

### 3.3 XdrReader (`src/reader.ts`)

```typescript
export class XdrReader {
  constructor(input: Uint8Array, limits?: Limits);

  readonly limits: LimitTracker;
  get offset(): number;
  get remaining(): number;

  readInt32(): number;
  readUint32(): number;
  readInt64(): bigint;
  readUint64(): bigint;
  readFloat32(): number;
  readFloat64(): number;
  readBool(): boolean;
  readFixedOpaque(n: number): Uint8Array;   // + padding validation
  readVarOpaque(maxLength?: number): Uint8Array;
  readString(maxLength?: number): string;    // UTF-8 via TextDecoder
  readPadding(n: number): void;              // Validates zero bytes
  readBytes(n: number): Uint8Array;          // Raw, no padding
  ensureEnd(): void;                          // Throws if bytes remain
}
```

### 3.4 XdrWriter (`src/writer.ts`)

```typescript
export class XdrWriter {
  constructor(initialCapacity?: number, limits?: Limits);

  readonly limits: LimitTracker;
  get offset(): number;

  writeInt32(value: number): void;
  writeUint32(value: number): void;
  writeInt64(value: bigint): void;
  writeUint64(value: bigint): void;
  writeFloat32(value: number): void;
  writeFloat64(value: number): void;
  writeBool(value: boolean): void;
  writeFixedOpaque(data: Uint8Array, n: number): void;
  writeVarOpaque(data: Uint8Array, maxLength?: number): void;
  writeString(value: string, maxLength?: number): void;
  writePadding(n: number): void;
  writeBytes(data: Uint8Array): void;
  toUint8Array(): Uint8Array;  // Returns trimmed copy
}
```

**Growable buffer**: starts at 256 bytes, doubles when needed. Uses `DataView` for big-endian multi-byte writes.

**Validation**: `writeInt32` validates `[-2^31, 2^31-1]`, `writeUint32` validates `[0, 2^32-1]`, `writeInt64`/`writeUint64` validate bigint ranges, `readBool` rejects values other than 0/1.

### 3.5 XdrCodec Interface (`src/codec.ts`)

```typescript
export interface XdrCodec<T> {
  encode(writer: XdrWriter, value: T): void;
  decode(reader: XdrReader): T;

  // Convenience methods
  toXdr(value: T, limits?: Limits): Uint8Array;
  fromXdr(input: Uint8Array | ArrayBufferLike, limits?: Limits): T;
  toBase64(value: T, limits?: Limits): string;
  fromBase64(input: string, limits?: Limits): T;
}

export abstract class BaseCodec<T> implements XdrCodec<T> {
  abstract encode(writer: XdrWriter, value: T): void;
  abstract decode(reader: XdrReader): T;

  toXdr(value: T, limits?: Limits): Uint8Array {
    const writer = new XdrWriter(undefined, limits);
    this.encode(writer, value);
    return writer.toUint8Array();
  }

  fromXdr(input: Uint8Array | ArrayBufferLike, limits?: Limits): T {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const reader = new XdrReader(bytes, limits);
    const result = this.decode(reader);
    reader.ensureEnd();
    return result;
  }

  toBase64(value: T, limits?: Limits): string {
    return encodeBase64(this.toXdr(value, limits));
  }

  fromBase64(input: string, limits?: Limits): T {
    return this.fromXdr(decodeBase64(input), limits);
  }
}
```

### 3.6 Primitives (`src/primitives.ts`)

Singleton `BaseCodec` instances. Primitives only call `limits.consumeLen()` — they do NOT consume depth (depth is tracked at composite boundaries only).

```typescript
export const int32: XdrCodec<number>;
export const uint32: XdrCodec<number>;
export const int64: XdrCodec<bigint>;
export const uint64: XdrCodec<bigint>;
export const float32: XdrCodec<number>;
export const float64: XdrCodec<number>;
export const bool: XdrCodec<boolean>;
export const xdrVoid: XdrCodec<void>;
```

### 3.7 Containers (`src/containers.ts`)

```typescript
export function fixedOpaque(n: number): XdrCodec<Uint8Array>;
export function varOpaque(maxLength?: number): XdrCodec<Uint8Array>;
export function xdrString(maxLength?: number): XdrCodec<string>;
export function fixedArray<T>(n: number, codec: XdrCodec<T>): XdrCodec<readonly T[]>;
export function varArray<T>(max: number, codec: XdrCodec<T>): XdrCodec<readonly T[]>;
export function option<T>(codec: XdrCodec<T>): XdrCodec<T | undefined>;
```

All container codecs handle 4-byte padding (for opaque/string) and validate lengths against bounds.

### 3.8 Composites (`src/composites.ts`)

#### `xdrStruct`

```typescript
export function xdrStruct<T extends Record<string, unknown>>(
  fields: ReadonlyArray<readonly [string, XdrCodec<any>]>
): XdrCodec<T>;
```

Wraps encode/decode in `limits.withDepth()`. Encodes fields sequentially; decodes by building a plain object.

#### `xdrEnum`

```typescript
export function xdrEnum<D extends Record<string, number>>(
  members: D
): XdrCodec<keyof D & string> & Readonly<D>;
```

Returns an object that is BOTH an `XdrCodec<MemberName>` AND has the enum member properties. Builds a reverse map (number → name) for decoding. Throws `InvalidEnumValue` on unknown values.

```typescript
// Usage:
const AssetType = xdrEnum({ Native: 0, CreditAlphanum4: 1 });
AssetType.Native       // → 0 (number)
AssetType.encode(w, 'Native')  // writes 0x00000000
AssetType.decode(r)    // reads i32, returns 'Native'
```

#### `taggedUnion`

```typescript
export function taggedUnion(config: {
  switchOn: XdrCodec<any>;
  arms: ReadonlyArray<{
    tags: readonly (string | number)[];
    codec?: XdrCodec<any>;  // undefined = void arm
  }>;
  defaultArm?: { codec?: XdrCodec<any> };
}): XdrCodec<any>;
```

Wraps in `limits.withDepth()`. Builds a tag → arm lookup map. Encodes discriminant then arm value; decodes discriminant then arm value. Void arms produce `{ tag }` with no `value` field. Type safety comes from the generated type alias + codec cast.

### 3.9 Base64 (`src/base64.ts`)

```typescript
export function encodeBase64(data: Uint8Array): string;
export function decodeBase64(input: string): Uint8Array;  // strips whitespace
```

Uses `Buffer` in Node.js, `btoa`/`atob` in browsers. Standard base64 alphabet (RFC 4648 §4).

---

## 4. Generated Code Patterns

### 4.1 Constants

```
const MAX_SIGNERS = 20;
```
→
```typescript
export const MAX_SIGNERS = 20;
```

### 4.2 Typedefs — Type-Value Duality

Every typedef produces both a `type` (zero-cost) and a `const` (codec). TypeScript allows both to share the same name.

```
typedef opaque Hash[32];        →  export type Hash = Uint8Array;
                                   export const Hash: XdrCodec<Hash> = fixedOpaque(32);

typedef opaque Signature<64>;   →  export type Signature = Uint8Array;
                                   export const Signature: XdrCodec<Signature> = varOpaque(64);

typedef uint64 TimePoint;       →  export type TimePoint = bigint;
                                   export const TimePoint: XdrCodec<TimePoint> = uint64;

typedef PublicKey AccountID;    →  export type AccountID = PublicKey;
                                   export const AccountID: XdrCodec<AccountID> = PublicKey;

typedef AccountID* Sponsor;     →  export type Sponsor = AccountID | undefined;
                                   export const Sponsor: XdrCodec<Sponsor> = option(AccountID);
```

### 4.3 Enums — String Literal Types

```
enum AssetType {
    ASSET_TYPE_NATIVE = 0,
    ASSET_TYPE_CREDIT_ALPHANUM4 = 1,
    ASSET_TYPE_CREDIT_ALPHANUM12 = 2,
    ASSET_TYPE_POOL_SHARE = 3
};
```
→
```typescript
export type AssetType = 'Native' | 'CreditAlphanum4' | 'CreditAlphanum12' | 'PoolShare';
export const AssetType = xdrEnum({
  Native: 0,
  CreditAlphanum4: 1,
  CreditAlphanum12: 2,
  PoolShare: 3,
});
```

**Prefix stripping**: Strip longest common underscore-boundary prefix (`ASSET_TYPE_`) and suffix, convert remainder to PascalCase. Enum references (`PUBLIC_KEY_TYPE_ED25519 = KEY_TYPE_ED25519`) are resolved to numeric values at generation time.

### 4.4 Structs — Readonly Interfaces

```
struct Price { int32 n; int32 d; };
```
→
```typescript
export interface Price {
  readonly n: number;
  readonly d: number;
}
export const Price: XdrCodec<Price> = xdrStruct<Price>([
  ['n', int32],
  ['d', int32],
]);
```

Complex struct example:
```typescript
export interface AccountEntry {
  readonly accountId: PublicKey;
  readonly balance: bigint;
  readonly inflationDest: PublicKey | undefined;
  readonly signers: readonly Signer[];
  readonly ext: AccountEntryExt;
}
export const AccountEntry: XdrCodec<AccountEntry> = xdrStruct<AccountEntry>([
  ['accountId', AccountID],
  ['balance', Int64],
  ['inflationDest', option(AccountID)],
  ['signers', varArray(MAX_SIGNERS, Signer)],
  ['ext', AccountEntryExt],
]);
```

### 4.5 Unions — Tagged Discriminated Types

#### Enum-discriminated (string tags)

```
union Asset switch (AssetType type) {
  case ASSET_TYPE_NATIVE: void;
  case ASSET_TYPE_CREDIT_ALPHANUM4: AlphaNum4 alphaNum4;
  case ASSET_TYPE_CREDIT_ALPHANUM12: AlphaNum12 alphaNum12;
};
```
→
```typescript
export type Asset =
  | { readonly tag: 'Native' }
  | { readonly tag: 'CreditAlphanum4'; readonly value: AlphaNum4 }
  | { readonly tag: 'CreditAlphanum12'; readonly value: AlphaNum12 };

export const Asset: XdrCodec<Asset> = taggedUnion({
  switchOn: AssetType,
  arms: [
    { tags: ['Native'] },
    { tags: ['CreditAlphanum4'], codec: AlphaNum4 },
    { tags: ['CreditAlphanum12'], codec: AlphaNum12 },
  ],
}) as XdrCodec<Asset>;
```

Void arms: `{ tag }` with no `value` property. TypeScript narrows correctly:
```typescript
switch (asset.tag) {
  case 'Native': /* no asset.value */ break;
  case 'CreditAlphanum4': asset.value.assetCode; /* AlphaNum4 */ break;
}
```

#### Int-discriminated (number tags)

```
union switch (int v) { case 0: void; case 1: AccountEntryExtensionV1 v1; }
```
→
```typescript
export type AccountEntryExt =
  | { readonly tag: 0 }
  | { readonly tag: 1; readonly value: AccountEntryExtensionV1 };
```

#### Default arm

```
union MyUnion switch (int v) { case 0: void; default: opaque data<100>; };
```
→
```typescript
export type MyUnion =
  | { readonly tag: 0 }
  | { readonly tag: number; readonly value: Uint8Array };

export const MyUnion: XdrCodec<MyUnion> = taggedUnion({
  switchOn: int32,
  arms: [{ tags: [0] }],
  defaultArm: { codec: varOpaque(100) },
}) as XdrCodec<MyUnion>;
```

### 4.6 Nested Definitions

Inline structs/enums/unions within a union are flattened to top level with combined name `ParentName` + `FieldName` (PascalCase). They are emitted before the containing type.

```
union SignerKey switch (...) {
  case ...: struct { uint256 ed25519; opaque payload<64>; } ed25519SignedPayload;
};
```
→
```typescript
// Emitted first
export interface SignerKeyEd25519SignedPayload {
  readonly ed25519: Uint8Array;
  readonly payload: Uint8Array;
}
export const SignerKeyEd25519SignedPayload: XdrCodec<SignerKeyEd25519SignedPayload> = ...;

// Then the union
export type SignerKey = ... | { readonly tag: 'Ed25519SignedPayload'; readonly value: SignerKeyEd25519SignedPayload };
```

### 4.7 Declaration Order

The generator must topologically sort definitions so every `const` is declared after its dependencies. TypeScript `type` aliases support forward references, but `const` values do not. Interleave `type` + `const` per definition in topological order.

---

## 5. End-to-End Developer Experience

```typescript
import { Asset, AssetType, AccountEntry } from './stellar_generated.js';

// ---- Decode from base64 ----
const asset = Asset.fromBase64('AAAAAQ==...');

// ---- Pattern match (fully typed) ----
switch (asset.tag) {
  case 'Native':
    console.log('XLM');
    break;
  case 'CreditAlphanum4':
    console.log(new TextDecoder().decode(asset.value.assetCode));
    break;
}

// ---- Construct + encode ----
const usdc: Asset = {
  tag: 'CreditAlphanum4',
  value: {
    assetCode: new TextEncoder().encode('USDC'),
    issuer: { tag: 'Ed25519', value: new Uint8Array(32) },
  },
};
const bytes = Asset.toXdr(usdc);
const base64 = Asset.toBase64(usdc);

// ---- Access enum numeric values ----
AssetType.Native            // 0
AssetType.CreditAlphanum4   // 1

// ---- Custom limits ----
const decoded = Asset.fromXdr(bytes, { depth: 100, len: 1024 });

// ---- Error handling ----
import { XdrError, XdrErrorCode } from 'ts-stellar-xdr';
try {
  Asset.fromXdr(malformedBytes);
} catch (err) {
  if (err instanceof XdrError && err.code === XdrErrorCode.InvalidUnionDiscriminant) {
    console.error('Unknown asset type');
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Core Runtime (`ts-stellar-xdr`)
Files in dependency order:
1. `errors.ts` → `limits.ts` → `base64.ts`
2. `reader.ts` → `writer.ts`
3. `codec.ts` → `primitives.ts` → `containers.ts` → `composites.ts`
4. `index.ts`

### Phase 2: Test Suite

#### 2a. Unit tests (hand-written)
- Reader/Writer: every method, padding validation, boundary values, underflow, buffer growth
- Primitives: roundtrip for all types, overflow/range errors
- Containers: fixed/var opaque, string (UTF-8), arrays, option — including max length violations
- Composites: struct, enum (unknown value), union (void arms, default arms, int-discriminated)
- Limits: depth exhaustion, byte limit exhaustion
- Base64: roundtrip, whitespace handling

#### 2b. Imported test vectors from `rs-stellar-xdr`

Port all relevant test cases from `stellar/rs-stellar-xdr/tests/` to ensure binary compatibility:

| Rust test file | What to port | Key fixtures |
|---|---|---|
| `tx_small.rs` | TransactionEnvelope roundtrip | Known base64 `"AAAAAgAAA..."` and exact byte vector `[0,0,0,2,0,0,0,0,...]` for a minimal tx with Memo::Text("Stellar") |
| `serde_tx.rs` | Complex tx with ChangeTrust op | Full byte-level source account (`0x3c,0xb3,...`), operation body, and expected JSON structure |
| `vecm.rs` | Variable-length container edge cases | Annotated byte fixtures for ScVal (maps, symbols, u32), BytesM valid/invalid lengths, oversized length prefix (`0xFF,0xFF,0xFF,0xFF`) |
| `tx_read_edge_cases.rs` | Buffer residual/underflow | `fromXdr` must reject extra trailing bytes; two u32s concatenated must fail as single u32, succeed as u64 |
| `default.rs` | Default/zero values | Default Uint32=0, Hash=zeros, TransactionEnvelope defaults to Tx variant |

**Approach**: Create a `tests/rs-compat/` directory containing:
- `fixtures.ts` — Exported byte arrays and base64 strings transcribed directly from the Rust test files (with source comments linking to the Rust originals)
- `rs-compat.test.ts` — Tests that encode/decode using our generated Stellar types and assert byte-for-byte equality with the Rust fixtures

**Roundtrip verification pattern** (for each fixture):
```typescript
// 1. Decode the known bytes → get a typed value
const decoded = TransactionEnvelope.fromXdr(KNOWN_BYTES);
// 2. Re-encode → must produce identical bytes
expect(TransactionEnvelope.toXdr(decoded)).toEqual(KNOWN_BYTES);
// 3. Base64 roundtrip must match too
expect(TransactionEnvelope.toBase64(decoded)).toBe(KNOWN_BASE64);
// 4. Spot-check decoded field values
expect(decoded.tag).toBe('Tx');
```

**Edge case tests** (from `tx_read_edge_cases.rs`):
```typescript
// Two u32s concatenated: should fail fromXdr for u32 (extra bytes), succeed for u64
const twoU32s = concat(uint32.toXdr(1), uint32.toXdr(2));
expect(() => uint32.fromXdr(twoU32s)).toThrow(XdrErrorCode.BufferNotFullyConsumed);
expect(uint64.fromXdr(twoU32s)).toBe((1n << 32n) | 2n);
```

### Phase 3: xdrgen TypeScript Backend
1. `lib/xdrgen/generators/typescript.rb` inheriting `Xdrgen::Generators::Base`
2. Topological sort for declaration ordering
3. Enum prefix stripping algorithm
4. Name conversion (PascalCase types, camelCase fields)
5. Code generation for each definition type (const, typedef, enum, struct, union)
6. Test fixtures (`.x` → expected `.ts` output)

---

## 7. Package Configuration

```jsonc
// package.json
{
  "name": "ts-stellar-xdr",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": { "build": "tsc", "test": "vitest run" },
  "devDependencies": { "typescript": "^5.4", "vitest": "^2.0" },
  "engines": { "node": ">=18" }
}
```

```jsonc
// tsconfig.json — ES2020 target (minimum for native BigInt)
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

Zero runtime dependencies. Browser + Node.js compatible.

---

## 8. Verification

1. **Unit tests**: `vitest run` — all primitives, containers, composites pass roundtrip tests
2. **rs-stellar-xdr compatibility**: All ported test vectors from `stellar/rs-stellar-xdr/tests/` pass byte-for-byte (see Phase 2b above)
3. **Integration test**: Hand-write a small `.x` schema, generate TS via the xdrgen backend, verify encode/decode roundtrip matches known binary fixtures
4. **Stellar compatibility test**: Generate types from `stellar/stellar-xdr` `.x` files, decode real Stellar transaction envelopes (base64 from Horizon API), verify fields match expected values
5. **Cross-implementation test**: Encode values with `ts-stellar-xdr`, decode with `rs-stellar-xdr` (and vice versa) to verify binary compatibility
