# Bundle Size Analysis

Comparison of production bundle sizes for an identical "create account" transaction example across three Stellar SDK approaches.

## The Example

Each bundle implements the same workflow:
1. Generate two Ed25519 keypairs (Alice & Bob)
2. Fund Alice via Friendbot
3. Fetch Alice's account/sequence number via Soroban RPC
4. Build a `CreateAccount` transaction (10 XLM to Bob)
5. Sign and submit via RPC

## Results

### Browser bundles (esbuild --minify --platform=browser --target=es2022)

| Bundle | Raw | Gzip | Brotli | vs Official |
|--------|----:|-----:|-------:|:-----------:|
| **Modern** (`tx-builder` + `rpc-client` + `friendbot-client`) | **75.6 KB** | **22.5 KB** | **19.5 KB** | **13.2x smaller** |
| **Compat** (`stellar-sdk-comp`) | **123.4 KB** | **36.7 KB** | **31.3 KB** | **8.1x smaller** |
| Official (`@stellar/stellar-sdk` v14.5.0) | 995.6 KB | 271.8 KB | 206 KB | 1x (baseline) |
| Official `/minimal` variant | 838.1 KB | 217.9 KB | 165.5 KB | 1.2x smaller |

### Size reduction summary

| Metric | Modern vs Official | Compat vs Official | Modern vs Compat |
|--------|-------------------:|-------------------:|-----------------:|
| Raw | **-92.4%** (920 KB saved) | **-87.6%** (872 KB saved) | **-38.7%** |
| Gzip | **-91.7%** (249 KB saved) | **-86.5%** (235 KB saved) | **-38.7%** |
| Brotli | **-90.5%** (187 KB saved) | **-84.8%** (175 KB saved) | **-37.7%** |

## What's in each bundle?

### Modern (75.6 KB)

| Module | Size | % |
|--------|-----:|--:|
| `stellar_generated.js` (XDR type definitions) | 41.0 KB | 54% |
| `@noble/ed25519` (Ed25519 crypto) | 6.7 KB | 9% |
| `rpc-client` (parsers, client, assembly) | ~6 KB | 8% |
| XDR codecs (composites, containers, reader, writer) | ~10 KB | 13% |
| `tx-builder` (keypair, builder, operations) | ~5 KB | 7% |
| `friendbot-client` | ~1 KB | 1% |
| Other (strkey, primitives, errors) | ~6 KB | 8% |

### Compat SDK (123.4 KB)

| Module | Size | % |
|--------|-----:|--:|
| `stellar_generated.js` (XDR type definitions) | 42.4 KB | 34% |
| `stellar_compat.js` (compat type wrappers) | 18.4 KB | 15% |
| `@noble/ed25519` (Ed25519 crypto) | 6.9 KB | 6% |
| `@noble/hashes` (SHA-512 for sync keypairs) | 5.5 KB | 4% |
| `operation.js` (25+ operation factories) | 4.1 KB | 3% |
| `rpc-client` + `horizon-client` | ~8 KB | 6% |
| XDR codecs + tx-builder | ~15 KB | 12% |
| Other (keypair, account, memo, etc.) | ~22 KB | 18% |

**Compat overhead vs Modern: +47.8 KB (+63%)**. The extra cost comes from:
- Compat type wrappers (`stellar_compat.js`): +18.4 KB
- `@noble/hashes` for sync Keypair: +5.5 KB
- Operation wrappers, Account, Asset, Memo classes: ~10 KB
- Horizon client (not used in modern example): ~5 KB

### Official SDK (995.6 KB)

The official SDK ships a pre-bundled `stellar-sdk.min.js` (994.4 KB) as its browser entry point. esbuild cannot tree-shake it further. The SDK includes:
- `stellar-base` (XDR, crypto, transaction building)
- `axios` HTTP client
- `eventsource` polyfill
- `urijs` URL manipulation
- `bignumber.js`
- Buffer polyfills
- Horizon server + call builders
- Soroban RPC server

## Official SDK variant bundles (pre-built)

| Variant | Raw | Gzip |
|---------|----:|-----:|
| `stellar-sdk.min.js` (full) | 968.9 KB | 249.9 KB |
| `stellar-sdk-no-axios.min.js` | 943.4 KB | 238.7 KB |
| `stellar-sdk-no-eventsource.min.js` | 840.4 KB | 209.6 KB |
| `stellar-sdk-minimal.min.js` (no axios, no eventsource) | 814.9 KB | 199.0 KB |

Even the minimal official variant (815 KB) is **10.8x larger** than the modern bundle (75.6 KB).

## Why the difference?

1. **ESM + tree-shaking**: The modern packages are pure ESM with granular exports. Bundlers can eliminate unused code. The official SDK ships a pre-bundled UMD blob that cannot be tree-shaken.

2. **Zero polyfills**: The modern packages use native `fetch`, `crypto.subtle`, `Uint8Array`, and `BigInt`. The official SDK bundles polyfills for `Buffer`, `EventSource`, and HTTP client libraries.

3. **No class hierarchies**: The modern packages use plain objects, string literals, and codec composition instead of deep class inheritance trees. This produces smaller, more shakeable code.

4. **Single-purpose packages**: Importing `@stellar/tx-builder` + `@stellar/rpc-client` pulls in only what's needed. Importing `@stellar/stellar-sdk` pulls in everything (Horizon, Soroban, contract client, etc.) in one monolithic bundle.

## Methodology

- **Bundler**: esbuild v0.21.5
- **Settings**: `--bundle --minify --format=esm --target=es2022 --platform=browser`
- **Measurement**: `wc -c` (raw), `gzip -c | wc -c` (gzip), `brotli -c | wc -c` (brotli)
- **Date**: 2026-02-26
- **Official SDK version**: @stellar/stellar-sdk v14.5.0
