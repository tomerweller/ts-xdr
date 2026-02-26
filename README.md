# ts-xdr

A modern, TypeScript-first [XDR (RFC 4506)](https://www.rfc-editor.org/rfc/rfc4506) codec library. Zero runtime dependencies, fully type-safe, with support for binary, Base64, and JSON formats. Aligned with [SEP-0051](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0051.md) JSON representation.

Built to replace the aging `@stellar/js-xdr` as the foundation for the next-generation TypeScript Stellar SDK. Inspired by [`rs-stellar-xdr`](https://github.com/stellar/rs-stellar-xdr) (Rust) but tailored to TypeScript idioms.

## Features

- **RFC 4506 compliant** — full XDR specification support
- **SEP-0051 aligned** — JSON serialization follows the Stellar JSON standard
- **Zero runtime dependencies** — only TypeScript and Vitest as dev dependencies
- **Type-safe** — externally-tagged unions, string-literal enums, readonly interfaces
- **Native BigInt** — 64-bit integers use JavaScript's native `bigint`
- **Cross-platform** — works in Node.js (>=18) and browsers
- **Code-generated types** — generated from `.x` schema files via `xdrgen`
- **Safety limits** — depth and byte-count tracking to prevent denial-of-service

## Comparison with `@stellar/js-xdr`

`ts-xdr` is a ground-up replacement for [`@stellar/js-xdr`](https://github.com/stellar/js-xdr). Here's how they differ:

| | `@stellar/js-xdr` | `ts-xdr` |
|---|---|---|
| **Language** | JavaScript | TypeScript |
| **Type safety** | None built-in (requires separate [`dts-xdr`](https://github.com/stellar/dts-xdr) for `.d.ts` generation) | First-class — all types inferred from codec definitions |
| **Data model** | Class instances with internal `_attributes` object | Plain readonly objects and interfaces |
| **Structs** | `new Struct({ field: value })`, access via `obj.field()` getter methods | `{ field: value }` plain objects, direct property access |
| **Enums** | Enum instances with `.name` / `.value` properties, accessed via `EnumType.memberName()` factory methods | String literals (`'native'`), integer values as static properties (`EnumType.native === 0`) |
| **Unions** | `new Union(switch, value)` with `.switch()`, `.arm()`, `.value()` methods | Externally-tagged: `'native'` for void arms, `{ credit_alphanum4: {...} }` for value arms |
| **64-bit integers** | Custom `Hyper` / `UnsignedHyper` wrapper classes | Native `bigint` |
| **Optionals** | `null` / instance | `T \| null` |
| **JSON** | Not supported | SEP-0051 aligned `toJson()`/`fromJson()` |
| **Validation** | `instanceof` / constructor name checks | Structural typing — any object with the right shape works |
| **Dependencies** | Runtime dependencies | Zero runtime dependencies |
| **Module format** | CommonJS + ESM | ESM only |
| **Limits** | Depth tracking only | Depth + byte-count tracking |

### Example: reading an Asset

**`@stellar/js-xdr`:**
```javascript
const asset = Asset.fromXDR(bytes);
asset.switch().name;             // 'assetTypeCreditAlphanum4'
asset.alphaNum4().assetCode();   // Buffer
```

**`ts-xdr`:**
```typescript
const asset = Asset.fromXdr(bytes);
if (is(asset, 'credit_alphanum4')) {
  asset.credit_alphanum4.asset_code; // Uint8Array
}
// or for void arms:
asset === 'native'; // true
```

## Installation

```bash
npm install ts-xdr
```

Requires Node.js >= 18.

## Quick Start

```typescript
import {
  int32, uint32, bool, xdrString,
  fixedOpaque, varArray, option,
  xdrStruct, xdrEnum, taggedUnion, is,
} from 'ts-xdr';

// Define an enum (snake_case per SEP-0051)
const Color = xdrEnum({ red: 0, green: 1, blue: 2 });

Color.red;   // 0
Color.green; // 1

// Encode / decode
const bytes = Color.toXdr('red');
const color = Color.fromXdr(bytes); // 'red'

// Define a struct
interface Point {
  readonly x: number;
  readonly y: number;
}

const Point = xdrStruct<Point>([
  ['x', int32],
  ['y', int32],
]);

const encoded = Point.toXdr({ x: 10, y: 20 });
const decoded = Point.fromXdr(encoded); // { x: 10, y: 20 }

// Base64 support
const base64 = Point.toBase64({ x: 10, y: 20 });
const fromB64 = Point.fromBase64(base64);

// JSON support (SEP-0051)
const json = Point.toJson({ x: 10, y: 20 });
const fromJson = Point.fromJson(json);
```

## Type Mapping

| XDR Type | TypeScript Type | Codec |
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
| `T[N]` | `readonly T[]` | `fixedArray(N, codec)` |
| `T<N>` | `readonly T[]` | `varArray(N, codec)` |
| `T*` | `T \| null` | `option(codec)` |
| `struct` | `readonly interface` | `xdrStruct([...])` |
| `enum` | String literal union | `xdrEnum({...})` |
| `union switch` (void arm) | `string` | `taggedUnion({...})` |
| `union switch` (value arm) | `{ key: T }` | `taggedUnion({...})` |

## API

### Codec Interface

Every codec implements `XdrCodec<T>`:

```typescript
interface XdrCodec<T> {
  // Low-level: read/write within a stream
  encode(writer: XdrWriter, value: T): void;
  decode(reader: XdrReader): T;

  // High-level: standalone encode/decode
  toXdr(value: T, limits?: Limits): Uint8Array;
  fromXdr(input: Uint8Array | ArrayBufferLike, limits?: Limits): T;
  toBase64(value: T, limits?: Limits): string;
  fromBase64(input: string, limits?: Limits): T;

  // JSON (SEP-0051)
  toJsonValue(value: T): unknown;
  fromJsonValue(json: unknown): T;
  toJson(value: T): string;
  fromJson(input: string): T;
}
```

### Primitives

```typescript
import { int32, uint32, int64, uint64, float32, float64, bool, xdrVoid } from 'ts-xdr';

int32.toXdr(-42);          // Uint8Array
uint64.toXdr(100n);        // bigint for 64-bit types
bool.toXdr(true);
```

### Containers

```typescript
import { fixedOpaque, varOpaque, xdrString, fixedArray, varArray, option } from 'ts-xdr';

// Fixed-length opaque data (padded to 4-byte boundary)
const hash = fixedOpaque(32);

// Variable-length opaque with max size
const payload = varOpaque(1024);

// UTF-8 string with max length
const name = xdrString(100);

// Fixed-length array of 3 int32s
const triple = fixedArray(3, int32);

// Variable-length array with max 10 elements
const list = varArray(10, int32);

// Optional value (null = absent)
const maybeInt = option(int32);
maybeInt.toXdr(42);   // present
maybeInt.toXdr(null);  // absent
```

### Structs

```typescript
import { xdrStruct, int32, xdrString } from 'ts-xdr';

interface Person {
  readonly name: string;
  readonly age: number;
}

const Person = xdrStruct<Person>([
  ['name', xdrString(100)],
  ['age', int32],
]);

const bytes = Person.toXdr({ name: 'Alice', age: 30 });
```

### Enums

Enums use string literals for type safety and expose integer values as properties:

```typescript
import { xdrEnum } from 'ts-xdr';

type AssetType = 'native' | 'credit_alphanum4' | 'credit_alphanum12';

const AssetType = xdrEnum({
  native: 0,
  credit_alphanum4: 1,
  credit_alphanum12: 2,
});

AssetType.native;             // 0
AssetType.toXdr('native');    // encodes as int32
AssetType.fromXdr(bytes);     // 'native' | 'credit_alphanum4' | 'credit_alphanum12'
```

### Tagged Unions

Unions use an externally-tagged format (SEP-0051). Void arms decode as plain strings, value arms as single-key objects:

```typescript
import { taggedUnion, xdrStruct, xdrEnum, fixedOpaque, is } from 'ts-xdr';

// Assuming AlphaNum4 and AlphaNum12 structs are defined...

type Asset =
  | 'native'
  | { readonly credit_alphanum4: AlphaNum4 }
  | { readonly credit_alphanum12: AlphaNum12 };

const Asset = taggedUnion({
  switchOn: AssetType,
  arms: [
    { tags: ['native'] },
    { tags: ['credit_alphanum4'], codec: AlphaNum4 },
    { tags: ['credit_alphanum12'], codec: AlphaNum12 },
  ],
}) as XdrCodec<Asset>;

// Encode
Asset.toXdr('native');
Asset.toXdr({ credit_alphanum4: { asset_code, issuer } });

// Decode and pattern match
const asset = Asset.fromXdr(bytes);
if (asset === 'native') {
  // void arm
} else if (is(asset, 'credit_alphanum4')) {
  console.log(asset.credit_alphanum4.asset_code);
}
```

For int-discriminated unions, provide an explicit `key` for each arm:

```typescript
const TransactionExt = taggedUnion({
  switchOn: int32,
  arms: [{ tags: [0], key: 'v0' }],
});
// Decodes as 'v0' (string)
```

### `is()` Helper

The `is()` function is a type guard for checking which arm of a union is present:

```typescript
import { is } from 'ts-xdr';

const asset = Asset.fromXdr(bytes);
if (is(asset, 'credit_alphanum4')) {
  // TypeScript knows asset is { credit_alphanum4: AlphaNum4 }
  console.log(asset.credit_alphanum4.asset_code);
}
```

### JSON (SEP-0051)

All codecs support JSON serialization aligned with SEP-0051:

```typescript
// Serialize to JSON string
const json = Asset.toJson('native');          // '"native"'
const json2 = uint64.toJson(100n);            // '"100"' (bigint → string)
const json3 = fixedOpaque(4).toJson(bytes);   // '"deadbeef"' (hex)

// Deserialize from JSON string
const asset = Asset.fromJson('"native"');
const val = uint64.fromJson('"100"');         // 100n

// Low-level: convert to/from JSON-safe values
const jsonVal = Asset.toJsonValue('native');  // 'native'
const restored = Asset.fromJsonValue(jsonVal);
```

### Lazy (Circular Dependencies)

Use `lazy()` to break circular type references in generated code:

```typescript
import { lazy } from 'ts-xdr';

const Tree: XdrCodec<Tree> = xdrStruct<Tree>([
  ['value', int32],
  ['children', varArray(10, lazy(() => Tree))],
]);
```

### Reader & Writer

For advanced use, work directly with the binary stream:

```typescript
import { XdrReader, XdrWriter } from 'ts-xdr';

// Write
const writer = new XdrWriter();
writer.writeInt32(42);
writer.writeString('hello');
const bytes = writer.toUint8Array();

// Read
const reader = new XdrReader(bytes);
reader.readInt32();  // 42
reader.readString(); // 'hello'
reader.ensureEnd();  // throws if bytes remain
```

### Hex Utilities

Convert between `Uint8Array` and hex strings:

```typescript
import { bytesToHex, hexToBytes } from 'ts-xdr';

bytesToHex(new Uint8Array([0xde, 0xad])); // 'dead'
hexToBytes('dead');                        // Uint8Array([0xde, 0xad])
```

### Limits

Control resource consumption with depth and byte limits:

```typescript
import { DEFAULT_LIMITS } from 'ts-xdr';

// Default: { depth: 512, len: 256 * 1024 * 1024 }

// Custom limits
const decoded = SomeType.fromXdr(bytes, { depth: 100, len: 1024 });
```

### Error Handling

All errors throw `XdrError` with a typed error code:

```typescript
import { XdrError, XdrErrorCode } from 'ts-xdr';

try {
  SomeType.fromXdr(malformedBytes);
} catch (err) {
  if (err instanceof XdrError) {
    switch (err.code) {
      case XdrErrorCode.BufferUnderflow:
      case XdrErrorCode.InvalidValue:
      case XdrErrorCode.InvalidEnumValue:
      case XdrErrorCode.InvalidUnionDiscriminant:
      case XdrErrorCode.NonZeroPadding:
      case XdrErrorCode.BufferNotFullyConsumed:
      case XdrErrorCode.DepthLimitExceeded:
      case XdrErrorCode.ByteLimitExceeded:
      // ...
    }
  }
}
```

## Code Generation

Types are generated from XDR schema files (`.x`) using a TypeScript backend for [`stellar/xdrgen`](https://github.com/stellar/xdrgen). The generator produces a single `.ts` file containing type definitions and codec instances for all types in the schema.

Generated code uses TypeScript's type-value duality pattern:

```typescript
// Type alias and codec constant share the same name
export type Uint32 = number;
export const Uint32: XdrCodec<Uint32> = uint32;

// Struct interface and codec constant share the same name
export interface SomeStruct { readonly field: number; }
export const SomeStruct: XdrCodec<SomeStruct> = xdrStruct([['field', int32]]);
```

## Project Structure

```
ts-xdr/
├── src/                    # Runtime library
│   ├── index.ts            # Public API
│   ├── reader.ts           # XdrReader (deserialization)
│   ├── writer.ts           # XdrWriter (serialization)
│   ├── codec.ts            # XdrCodec interface & BaseCodec
│   ├── primitives.ts       # int32, uint32, int64, uint64, float, bool, void
│   ├── containers.ts       # opaque, string, arrays, option
│   ├── composites.ts       # struct, enum, union, lazy, is
│   ├── hex.ts              # Hex encode/decode utilities
│   ├── errors.ts           # XdrError and error codes
│   ├── limits.ts           # Depth/byte limit tracking
│   └── base64.ts           # Cross-platform Base64
├── tests/                  # Test suite (Vitest)
│   ├── reader.test.ts
│   ├── writer.test.ts
│   ├── primitives.test.ts
│   ├── containers.test.ts
│   ├── composites.test.ts
│   ├── integration.test.ts
│   └── rs-compat/          # Cross-implementation tests against rs-stellar-xdr
├── generated/              # Generated Stellar XDR types
├── generator/              # xdrgen TypeScript backend (Ruby)
├── vendor/                 # Vendored xdrgen + Stellar XDR schemas
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test
```

## Design Principles

1. **Type safety first** — leverage TypeScript's type system for compile-time correctness. Externally-tagged unions, string-literal enums, and readonly interfaces.
2. **SEP-0051 alignment** — JSON serialization follows the Stellar ecosystem standard.
3. **Zero runtime dependencies** — the library has no production dependencies.
4. **Codec composability** — small, composable codec building blocks that combine to represent any XDR schema.
5. **Correctness** — strict validation of values, padding, and limits. Cross-verified against the Rust `rs-stellar-xdr` implementation.
6. **Simplicity** — minimal API surface. One way to do things.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.
