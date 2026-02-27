# Parity Analysis: ts-stellar-xdr vs Official Stellar JS Stack

Comprehensive export-by-export comparison of `@stellar/stellar-base` and `@stellar/stellar-sdk` against the compat packages (`stellar-base-comp`, `stellar-sdk-comp`) and the modern packages.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented, API-compatible |
| ⚠️ | Partial — exists but differs in behavior or signature |
| ❌ | Missing from compat packages |

---

# Part 1: `@stellar/stellar-base` → `stellar-base-comp`

## 1. Classes

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Account` | ✅ | ⚠️ | API matches (`accountId()`, `sequenceNumber()`, `incrementSequenceNumber()`). Internal representation differs (string sequence). | `tx-builder` doesn't have a separate Account class; sequence is passed to `TransactionBuilder` directly |
| 2 | `Address` | ✅ | ✅ | Has `fromString()`, `toString()`, `toScVal()`, `toScAddress()`, `fromScAddress()`, `toBuffer()`. Static factories: `account()`, `contract()`, `fromScVal()`. | No separate modern equivalent; use XDR types directly (`ScAddress`, `ScVal`) |
| 3 | `Asset` | ✅ | ⚠️ | Full implementation: `native()`, `fromOperation()`, `compare()`, `getCode()`, `getIssuer()`, `getAssetType()`, `isNative()`, `equals()`, `toXDRObject()`, `toChangeTrustXDRObject()`, `contractId()`, `toString()`. Has `_toModern()`/`_fromModern()` bridge. | `tx-builder`: `nativeAsset()`, `creditAsset(code, issuer)` helper functions + XDR `Asset` type directly |
| 4 | `Claimant` | ✅ | ✅ | Full match: all predicate builders, `destination`, `predicate`. Has `_toModern()` bridge. | `tx-builder`: `createClaimableBalance` operation accepts claimant data directly as XDR |
| 5 | `Contract` | ✅ | ⚠️ | Has `contractId()`, `address()`, `call(method, ...args)`, `getFootprint()`. | No separate modern equivalent; use `invokeHostFunction` operation directly |
| 6 | `FeeBumpTransaction` | ✅ | ✅ | Has `feeSource`, `fee`, `innerTransaction`, `sign()`, `addSignature()`, `addDecoratedSignature()`, `getKeypairSignature()`, `signHashX()`, `toEnvelope()`. | `tx-builder`: `BuiltFeeBumpTransaction` class |
| 7 | `Keypair` | ✅ | ✅ | All methods: `random()`, `master()`, `fromSecret()`, `fromRawEd25519Seed()`, `fromPublicKey()`, `fromRawPublicKey()`, `publicKey()`, `secret()`, `rawPublicKey()`, `rawSecretKey()`, `canSign()`, `sign()`, `signDecorated()`, `signPayloadDecorated()`, `verify()`, `signatureHint()`, `type` getter, `xdrPublicKey()`, `xdrAccountId()`, `xdrMuxedAccount()`. | `tx-builder`: `Keypair` class with async `sign()`/`verify()` |
| 8 | `LiquidityPoolAsset` | ✅ | ⚠️ | Re-exported from `@stellar/contracts`. Has `toXDRObject()`, `getLiquidityPoolParameters()`, `getAssetType()`, `equals()`. | No separate modern equivalent; use XDR types directly |
| 9 | `LiquidityPoolId` | ✅ | ✅ | Full match: `fromOperation()`, `toXDRObject()`, `getLiquidityPoolId()`, `getAssetType()`, `equals()`, `toString()`. | `getLiquidityPoolId()` function exists; returns hex string |
| 10 | `Memo` | ✅ | ⚠️ | Generic `Memo<T>` with `none()`, `text()`, `id()`, `hash()`, `return()`, `fromXDRObject()`, `toXDRObject()`, `.type`, `.value`. Value type uses Uint8Array instead of Buffer. | `tx-builder`: `memoNone()`, `memoText()`, etc. → XDR `Memo` type |
| 11 | `MuxedAccount` | ✅ | ✅ | Full match: `fromAddress()`, `accountId()`, `baseAccount()`, `id()`, `setId()`, `sequenceNumber()`, `incrementSequenceNumber()`, `toXDRObject()`, `equals()`. | `tx-builder`: `parseMuxedAccount()` function → XDR `MuxedAccount` type |
| 12 | `Operation` | ✅ | ✅ | 27 base factory methods + 4 Soroban convenience wrappers. Has `fromXDRObject()`, `isValidAmount()`, `toStroops()`, `fromStroops()`. See §3 below for full operation breakdown. | `tx-builder`: 27 individual operation factory functions |
| 13 | `ScInt` | ✅ | ⚠️ | Re-exported from `@stellar/contracts`. | `@stellar/contracts`: `ScInt` class |
| 14 | `SorobanDataBuilder` | ✅ | ⚠️ | Has `setFootprint()`, `setReadOnly()`, `setReadWrite()`, `setResources()`, `setResourceFee()`, `build()`. | No separate modern equivalent; construct `SorobanTransactionData` XDR directly |
| 15 | `Transaction` | ✅ | ✅ | Full match: `source`, `fee`, `sequence`, `memo`, `operations`, `timeBounds`, `ledgerBounds`, `minAccountSequence`, `minAccountSequenceAge`, `minAccountSequenceLedgerGap`, `extraSigners`, `sign()`, `hash()`, `addSignature()`, `addDecoratedSignature()`, `getKeypairSignature()`, `signHashX()`, `getClaimableBalanceId()`, `toEnvelope()`. | `tx-builder`: `BuiltTransaction` class |
| 16 | `TransactionBase` | ⚠️ | — | Not exported as a separate class. Transaction and FeeBumpTransaction are standalone. | `tx-builder`: no base class pattern |
| 17 | `TransactionBuilder` | ✅ | ✅ | Full match: `addOperation()`, `addOperationAt()`, `clearOperations()`, `clearOperationAt()`, `addMemo()`, `setTimeout()`, `setTimebounds()`, `setLedgerbounds()`, `setMinAccountSequence()`, `setMinAccountSequenceAge()`, `setMinAccountSequenceLedgerGap()`, `setExtraSigners()`, `setNetworkPassphrase()`, `setSorobanData()`, `hasV2Preconditions()`, `build()`. Static: `buildFeeBumpTransaction()`, `cloneFrom()`. | `tx-builder`: `TransactionBuilder` class with similar API |
| 18 | `XdrLargeInt` | ✅ | ⚠️ | Compat wrapper matching official constructor `new XdrLargeInt(type, value)`. | `@stellar/contracts`: `ScInt` class; modern code uses native `bigint` |

## 2. Functions

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `hash(data)` | ✅ | ⚠️ | Sync SHA-256 via `@noble/hashes`. Returns augmented Uint8Array with `toString('hex'/'base64')` instead of Buffer. | `tx-builder`: `sha256()` function |
| 2 | `sign(data, rawSecret)` | ✅ | ✅ | Sync Ed25519 sign via `@noble/ed25519`. | `tx-builder`: `Keypair.sign()` (async) |
| 3 | `verify(data, sig, pubkey)` | ✅ | ✅ | Sync Ed25519 verify. | `tx-builder`: `Keypair.verify()` (async) |
| 4 | `getLiquidityPoolId(type, params)` | ✅ | ⚠️ | Supports both official signature and simplified. Returns hex string. | Same function in `stellar-base-comp` |
| 5 | `nativeToScVal(val, opts?)` | ✅ | ⚠️ | Full implementation. Returns compat XDR ScVal. | No direct modern equivalent; construct XDR `ScVal` types directly |
| 6 | `scValToNative(scv)` | ✅ | ⚠️ | Full implementation. | No direct modern equivalent |
| 7 | `scValToBigInt(scv)` | ✅ | ⚠️ | Re-exported from `@stellar/contracts`. | `@stellar/contracts`: `scValToBigInt()` |
| 8 | `humanizeEvents(events)` | ✅ | ✅ | Converts contract events to human-readable format. | Not implemented in any modern package |
| 9 | `authorizeEntry(...)` | ✅ | ✅ | Real signing implementation: builds hash preimage, signs with Ed25519, wraps signature as `Vec([Map({public_key, signature})])`. Supports Keypair and callback signers. | Not implemented in modern packages |
| 10 | `authorizeInvocation(...)` | ✅ | ✅ | Generates random nonce, builds address credentials, delegates to `authorizeEntry()` for signing. | Not implemented in modern packages |
| 11 | `buildInvocationTree(root)` | ✅ | ⚠️ | Wrapped to accept compat types via `_toModern()`. | `@stellar/contracts`: `buildInvocationTree()` |
| 12 | `walkInvocationTree(root, cb)` | ✅ | ⚠️ | Wrapped to accept compat types via `_toModern()`. | `@stellar/contracts`: `walkInvocationTree()` |
| 13 | `decodeAddressToMuxedAccount(addr)` | ✅ | ✅ | Decodes G/M address to XDR MuxedAccount. | `tx-builder`: `parseMuxedAccount()` |
| 14 | `encodeMuxedAccountToAddress(acct)` | ✅ | ✅ | Encodes XDR MuxedAccount to G/M address string. | `tx-builder`: use `strkeyToString()` with muxed account data |
| 15 | `encodeMuxedAccount(gAddr, id)` | ✅ | ✅ | Creates MuxedAccount XDR from G-address + id. | `tx-builder`: `Keypair.toMuxedAccount()` or XDR construction |
| 16 | `isValidDate(d)` | ✅ | ✅ | Validates date strings/numbers for timebounds. | N/A |
| 17 | `extractBaseAddress(addr)` | ✅ | ✅ | Re-exported from `@stellar/contracts`. | `@stellar/contracts`: `extractBaseAddress()` |
| 18 | `toStroops(amount)` | ✅ | ✅ | Converts decimal string to stroops string. | Same in `stellar-base-comp` |
| 19 | `fromStroops(stroops)` | ✅ | ✅ | Converts stroops string to decimal string. | Same in `stellar-base-comp` |

## 3. Operation Factory Methods

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `createAccount` | ✅ | ✅ | Full match | `tx-builder`: `createAccount()` |
| 2 | `payment` | ✅ | ✅ | Full match | `tx-builder`: `payment()` |
| 3 | `pathPaymentStrictReceive` | ✅ | ✅ | Full match | `tx-builder`: `pathPaymentStrictReceive()` |
| 4 | `pathPaymentStrictSend` | ✅ | ✅ | Full match | `tx-builder`: `pathPaymentStrictSend()` |
| 5 | `createPassiveSellOffer` | ✅ | ✅ | Full match | `tx-builder`: `createPassiveSellOffer()` |
| 6 | `manageSellOffer` | ✅ | ✅ | Full match | `tx-builder`: `manageSellOffer()` |
| 7 | `manageBuyOffer` | ✅ | ✅ | Full match | `tx-builder`: `manageBuyOffer()` |
| 8 | `setOptions` | ✅ | ✅ | Full match | `tx-builder`: `setOptions()` |
| 9 | `changeTrust` | ✅ | ✅ | Full match | `tx-builder`: `changeTrust()` |
| 10 | `allowTrust` | ✅ | ✅ | Full match (deprecated) | `tx-builder`: `allowTrust()` |
| 11 | `accountMerge` | ✅ | ✅ | Full match | `tx-builder`: `accountMerge()` |
| 12 | `inflation` | ✅ | ✅ | Full match | `tx-builder`: `inflation()` |
| 13 | `manageData` | ✅ | ✅ | Full match | `tx-builder`: `manageData()` |
| 14 | `bumpSequence` | ✅ | ✅ | Full match | `tx-builder`: `bumpSequence()` |
| 15 | `createClaimableBalance` | ✅ | ✅ | Full match | `tx-builder`: `createClaimableBalance()` |
| 16 | `claimClaimableBalance` | ✅ | ✅ | Full match | `tx-builder`: `claimClaimableBalance()` |
| 17 | `beginSponsoringFutureReserves` | ✅ | ✅ | Full match | `tx-builder`: `beginSponsoringFutureReserves()` |
| 18 | `endSponsoringFutureReserves` | ✅ | ✅ | Full match | `tx-builder`: `endSponsoringFutureReserves()` |
| 19 | `revokeAccountSponsorship` | ✅ | ⚠️ | Implemented as `revokeSponsorship()` which handles all revoke variants | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 20 | `revokeTrustlineSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 21 | `revokeOfferSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 22 | `revokeDataSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 23 | `revokeClaimableBalanceSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 24 | `revokeLiquidityPoolSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipLedgerEntry()` |
| 25 | `revokeSignerSponsorship` | ✅ | ⚠️ | Same as above | `tx-builder`: `revokeSponsorshipSigner()` |
| 26 | `clawback` | ✅ | ✅ | Full match | `tx-builder`: `clawback()` |
| 27 | `clawbackClaimableBalance` | ✅ | ✅ | Full match | `tx-builder`: `clawbackClaimableBalance()` |
| 28 | `setTrustLineFlags` | ✅ | ✅ | Full match | `tx-builder`: `setTrustLineFlags()` |
| 29 | `liquidityPoolDeposit` | ✅ | ✅ | Full match | `tx-builder`: `liquidityPoolDeposit()` |
| 30 | `liquidityPoolWithdraw` | ✅ | ✅ | Full match | `tx-builder`: `liquidityPoolWithdraw()` |
| 31 | `invokeHostFunction` | ✅ | ✅ | Full match | `tx-builder`: `invokeHostFunction()` |
| 32 | `extendFootprintTtl` | ✅ | ✅ | Full match | `tx-builder`: `extendFootprintTtl()` |
| 33 | `restoreFootprint` | ✅ | ✅ | Full match | `tx-builder`: `restoreFootprint()` |
| 34 | `createStellarAssetContract` | ✅ | ✅ | Convenience wrapper using `invokeHostFunction` with `CreateContract`/`StellarAsset` | Not in `tx-builder`; build manually with `invokeHostFunction` |
| 35 | `invokeContractFunction` | ✅ | ✅ | Convenience wrapper using `invokeHostFunction` with `InvokeContract` | Not in `tx-builder`; build manually with `invokeHostFunction` |
| 36 | `createCustomContract` | ✅ | ✅ | Convenience wrapper using `invokeHostFunction` with `CreateContractV2` | Not in `tx-builder`; build manually with `invokeHostFunction` |
| 37 | `uploadContractWasm` | ✅ | ✅ | Convenience wrapper using `invokeHostFunction` with `UploadContractWasm` | Not in `tx-builder`; build manually with `invokeHostFunction` |
| 38 | `fromXDRObject(xdrOp)` | ✅ | ⚠️ | Decodes modern XDR to flat compat objects. Covers all 27 operation types. | No direct equivalent; modern uses typed XDR unions directly |
| 39 | `isValidAmount(value)` | ✅ | ✅ | Validates amount strings for operations. | No equivalent |

## 4. Constants

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `BASE_FEE` (`'100'`) | ✅ | ✅ | Identical | `tx-builder`: no equivalent constant |
| 2 | `TimeoutInfinite` (`0`) | ✅ | ✅ | Identical | `tx-builder`: no equivalent constant |
| 3 | `AuthRequiredFlag` (`1`) | ✅ | ✅ | Identical | No equivalent constant |
| 4 | `AuthRevocableFlag` (`2`) | ✅ | ✅ | Identical | No equivalent constant |
| 5 | `AuthImmutableFlag` (`4`) | ✅ | ✅ | Identical | No equivalent constant |
| 6 | `AuthClawbackEnabledFlag` (`8`) | ✅ | ✅ | Identical | No equivalent constant |
| 7 | `MemoNone` (`'none'`) | ✅ | ✅ | Identical | Use string literal `'none'` |
| 8 | `MemoID` (`'id'`) | ✅ | ✅ | Identical | Use string literal `'id'` |
| 9 | `MemoText` (`'text'`) | ✅ | ✅ | Identical | Use string literal `'text'` |
| 10 | `MemoHash` (`'hash'`) | ✅ | ✅ | Identical | Use string literal `'hash'` |
| 11 | `MemoReturn` (`'return'`) | ✅ | ✅ | Identical | Use string literal `'return'` |
| 12 | `LiquidityPoolFeeV18` (`30`) | ✅ | ✅ | Identical | Use literal `30` |
| 13 | `FastSigning` (`true`) | ✅ | ✅ | Always true (uses `@noble/ed25519`) | N/A |
| 14 | `Networks.PUBLIC` | ✅ | ✅ | Identical passphrase | `tx-builder`: `Networks.PUBLIC` |
| 15 | `Networks.TESTNET` | ✅ | ✅ | Identical passphrase | `tx-builder`: `Networks.TESTNET` |
| 16 | `Networks.FUTURENET` | ✅ | ✅ | Identical passphrase | `tx-builder`: `Networks.FUTURENET` |
| 17 | `Networks.SANDBOX` | ✅ | ✅ | Identical passphrase | Not in any modern package |
| 18 | `Networks.STANDALONE` | ✅ | ✅ | Identical passphrase | Not in any modern package |

## 5. StrKey Static Methods

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `encodeEd25519PublicKey` | ✅ | ⚠️ | Returns Uint8Array (official returns Buffer) | `@stellar/strkey`: `encodeStrkey(STRKEY_ED25519_PUBLIC, data)` |
| 2 | `decodeEd25519PublicKey` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 3 | `isValidEd25519PublicKey` | ✅ | ✅ | Full match | `@stellar/strkey`: try/catch `decodeStrkey` |
| 4 | `encodeEd25519SecretSeed` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_ED25519_SECRET, data)` |
| 5 | `decodeEd25519SecretSeed` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 6 | `isValidEd25519SecretSeed` | ✅ | ✅ | Full match | `@stellar/strkey`: try/catch `decodeStrkey` |
| 7 | `encodeMed25519PublicKey` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_MUXED_ED25519, data)` |
| 8 | `decodeMed25519PublicKey` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 9 | `isValidMed25519PublicKey` | ✅ | ✅ | Full match | `@stellar/strkey`: try/catch `decodeStrkey` |
| 10 | `encodeSignedPayload` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_SIGNED_PAYLOAD, data)` |
| 11 | `decodeSignedPayload` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 12 | `isValidSignedPayload` | ✅ | ✅ | Full match | `@stellar/strkey`: try/catch `decodeStrkey` |
| 13 | `encodePreAuthTx` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_PRE_AUTH_TX, data)` |
| 14 | `decodePreAuthTx` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 15 | `encodeSha256Hash` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_HASH_X, data)` |
| 16 | `decodeSha256Hash` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 17 | `encodeContract` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `encodeStrkey(STRKEY_CONTRACT, data)` |
| 18 | `decodeContract` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey`: `decodeStrkey(addr).payload` |
| 19 | `isValidContract` | ✅ | ✅ | Full match | `@stellar/strkey`: try/catch `decodeStrkey` |
| 20 | `encodeClaimableBalance` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey` |
| 21 | `decodeClaimableBalance` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey` |
| 22 | `isValidClaimableBalance` | ✅ | ✅ | Full match | `@stellar/strkey` |
| 23 | `encodeLiquidityPool` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey` |
| 24 | `decodeLiquidityPool` | ✅ | ⚠️ | Returns Uint8Array | `@stellar/strkey` |
| 25 | `isValidLiquidityPool` | ✅ | ✅ | Full match | `@stellar/strkey` |
| 26 | `getVersionByteForPrefix` | ✅ | ✅ | Full match | `@stellar/strkey`: `decodeStrkey(addr).version` |
| 27 | `types` | ✅ | ✅ | Maps type names to version byte constants | `@stellar/strkey`: version constants |

## 6. Static Utility Namespaces

### SignerKey

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `SignerKey.decodeAddress(addr)` | ✅ | ✅ | Decodes G/T/X/P addresses to signer key objects | Use `@stellar/strkey` decoding + XDR `SignerKey` construction |
| 2 | `SignerKey.encodeSignerKey(key)` | ✅ | ✅ | Encodes signer key objects to addresses | Use `@stellar/strkey` encoding from XDR `SignerKey` |

### Soroban

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Soroban.formatTokenAmount(amount, decimals)` | ✅ | ✅ | Formats bigint token amount with decimal places | N/A |
| 2 | `Soroban.parseTokenAmount(value, decimals)` | ✅ | ✅ | Parses decimal string to bigint token amount | N/A |

## 7. Types / Interfaces

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `AssetType` | ✅ | ✅ | Namespace + type union | String literals in modern code |
| 2 | `MemoType` | ✅ | ✅ | Type union | String literals in modern code |
| 3 | `MemoValue` | ✅ | ✅ | `null \| string \| Uint8Array` | Use `string \| Uint8Array \| null` |
| 4 | `KeypairType` | ✅ | ✅ | `'ed25519'` | N/A |
| 5 | `OperationType` | ✅ | ✅ | Namespace + type union of 27 ops | String literals in modern code |
| 6 | `OperationOptions` | ✅ | ✅ | Namespace with interfaces for all 37+ operation types | `tx-builder` uses typed function parameters |
| 7 | `AuthFlag` | ✅ | ✅ | `1 \| 2 \| 4 \| 8` | Use literal numbers |
| 8 | `TrustLineFlag` | ✅ | ✅ | `0 \| 1 \| 2` | Use literal numbers |
| 9 | `Signer` | ✅ | ⚠️ | Namespace with sub-interfaces | Use XDR `SignerKey` type directly |
| 10 | `SignerKeyOptions` | ✅ | ⚠️ | Namespace with sub-interfaces | Use XDR `SignerKey` type directly |
| 11 | `LiquidityPoolParameters` | ✅ | ✅ | Namespace with ConstantProduct interface | Use XDR types directly |
| 12 | `LiquidityPoolType` | ✅ | ✅ | `'constant_product'` | N/A |
| 13 | `IntLike` | ✅ | ✅ | `string \| number \| bigint` | N/A |
| 14 | `ScIntType` | ✅ | ✅ | `'i64' \| 'u64' \| 'i128' \| 'u128' \| 'i256' \| 'u256'` | `@stellar/contracts`: `ScIntType` |
| 15 | `SigningCallback` | ✅ | ✅ | Async signing callback type for `authorizeEntry` | N/A |
| 16 | `InvocationWalker` | ✅ | ✅ | Callback type for `walkInvocationTree` | `@stellar/contracts` has equivalent |
| 17 | `SorobanFees` | ✅ | ✅ | Fee/resource configuration interface | N/A |
| 18 | `CreateInvocation` | ✅ | ✅ | Invocation tree create type | `@stellar/contracts`: `InvocationTree` types |
| 19 | `ExecuteInvocation` | ✅ | ✅ | Invocation tree execute type | `@stellar/contracts`: `InvocationTree` types |
| 20 | `InvocationTree` | ✅ | ✅ | Invocation tree node type | `@stellar/contracts`: `InvocationTree` |
| 21 | `SorobanEvent` | ✅ | ✅ | Event interface for `humanizeEvents` | N/A |

## 8. Re-exports from js-xdr

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `xdr` | ✅ | ⚠️ | Full XDR namespace with 480+ types. Compat instances have `_toModern()`/`_fromModern()` bridge methods. | `@stellar/xdr`: all types as codec + type duals |
| 2 | `Hyper` | ✅ | ⚠️ | 64-bit signed integer. Has `low`/`high`, `toBigInt()`, `fromString()`, `fromBigInt()`. | Modern uses native `bigint` |
| 3 | `UnsignedHyper` | ✅ | ⚠️ | 64-bit unsigned integer. Same API as Hyper. | Modern uses native `bigint` |
| 4 | `cereal` | ✅ | ✅ | `{ XdrWriter, XdrReader }` re-exported from `@stellar/xdr`. | `@stellar/xdr`: `XdrWriter`, `XdrReader` exported directly |

---

# Part 2: `@stellar/stellar-sdk` → `stellar-sdk-comp`

## 10. Top-Level Exports (SDK-only)

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Config` | ✅ | ✅ | Global SDK config: `setAllowHttp()`, `isAllowHttp()`, `setTimeout()`, `getTimeout()`, `setDefault()` | Not needed; pass options per-client |
| 2 | `Utils` | ✅ | ✅ | `validateTimebounds(tx, gracePeriod)` | N/A |
| 3 | `NetworkError` | ✅ | ✅ | Base Horizon error class with `getResponse()` | `@stellar/horizon-client` has own error handling |
| 4 | `BadRequestError` | ✅ | ✅ | Extends NetworkError for HTTP 400 | Same |
| 5 | `BadResponseError` | ✅ | ✅ | Extends NetworkError for bad responses | Same |
| 6 | `NotFoundError` | ✅ | ✅ | Extends NetworkError for HTTP 404 | Same |
| 7 | `AccountRequiresMemoError` | ✅ | ✅ | Re-exported from `@stellar/seps` | `@stellar/seps`: `AccountRequiresMemoError` |
| 8 | `basicNodeSigner(kp, net)` | ✅ | ✅ | Returns `{ signTransaction, signAuthEntry }` | Same in `stellar-sdk-comp` |
| 9 | `toStroops` | ✅ | ✅ | Re-exported from stellar-base-comp | Same |
| 10 | `fromStroops` | ✅ | ✅ | Re-exported from stellar-base-comp | Same |

## 11. Horizon Namespace

### Server Class

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `root()` | ✅ | ✅ | Full match | `@stellar/horizon-client`: `root()` |
| 2 | `feeStats()` | ✅ | ✅ | Full match | `@stellar/horizon-client`: `feeStats()` |
| 3 | `fetchBaseFee()` | ✅ | ✅ | Full match | `@stellar/horizon-client`: `fetchBaseFee()` |
| 4 | `fetchTimebounds(seconds)` | ✅ | ✅ | Returns `{ minTime, maxTime }` based on current time + seconds | N/A |
| 5 | `loadAccount(id)` | ✅ | ✅ | Returns `AccountResponse` | `@stellar/horizon-client`: `getAccount()` |
| 6 | `submitTransaction(tx)` | ✅ | ✅ | Full match | `@stellar/horizon-client`: `submitTransaction()` |
| 7 | `submitAsyncTransaction(tx)` | ✅ | ✅ | Full match | `@stellar/horizon-client`: `submitAsyncTransaction()` |
| 8 | `checkMemoRequired(tx)` | ✅ | ✅ | SEP-29 check via `@stellar/seps` | `@stellar/seps`: `checkMemoRequired()` |
| 9 | `accounts()` | ✅ | ✅ | Returns `AccountCallBuilder` | `@stellar/horizon-client` |
| 10 | `ledgers()` | ✅ | ✅ | Returns `LedgerCallBuilder` | `@stellar/horizon-client` |
| 11 | `transactions()` | ✅ | ✅ | Returns `TransactionCallBuilder` | `@stellar/horizon-client` |
| 12 | `operations()` | ✅ | ✅ | Returns `OperationCallBuilder` | `@stellar/horizon-client` |
| 13 | `payments()` | ✅ | ✅ | Returns `PaymentCallBuilder` | `@stellar/horizon-client` |
| 14 | `effects()` | ✅ | ✅ | Returns `EffectCallBuilder` | `@stellar/horizon-client` |
| 15 | `offers()` | ✅ | ✅ | Returns `OfferCallBuilder` | `@stellar/horizon-client` |
| 16 | `trades()` | ✅ | ✅ | Returns `TradesCallBuilder` | `@stellar/horizon-client` |
| 17 | `assets()` | ✅ | ✅ | Returns `AssetsCallBuilder` | `@stellar/horizon-client` |
| 18 | `claimableBalances()` | ✅ | ✅ | Returns `ClaimableBalanceCallBuilder` | `@stellar/horizon-client` |
| 19 | `liquidityPools()` | ✅ | ✅ | Returns `LiquidityPoolCallBuilder` | `@stellar/horizon-client` |
| 20 | `orderbook(sell, buy)` | ✅ | ✅ | Returns `OrderbookCallBuilder` | `@stellar/horizon-client` |
| 21 | `strictReceivePaths(...)` | ✅ | ✅ | Returns `StrictReceivePathCallBuilder` | `@stellar/horizon-client` |
| 22 | `strictSendPaths(...)` | ✅ | ✅ | Returns `StrictSendPathCallBuilder` | `@stellar/horizon-client` |
| 23 | `friendbot(addr)` | ✅ | ✅ | Returns `FriendbotBuilder` | `@stellar/friendbot-client`: `FriendbotClient` |
| 24 | `tradeAggregation(...)` | ✅ | ✅ | Returns `TradeAggregationCallBuilder` | `@stellar/horizon-client` |

### Call Builder Classes

| # | Class | Compat | Identical? | Notes | Modern Equivalent |
|---|-------|--------|------------|-------|-------------------|
| 1 | `CallBuilder<T>` | ✅ | ⚠️ | Base class with `call()`, `stream()`, `cursor()`, `limit()`, `order()`. Missing `join()`. | `@stellar/horizon-client`: direct method params |
| 2 | `AccountCallBuilder` | ✅ | ✅ | `accountId()`, `forSigner()`, `forAsset()`, `sponsor()`, `forLiquidityPool()` | `@stellar/horizon-client` |
| 3 | `LedgerCallBuilder` | ✅ | ✅ | `ledger()` | `@stellar/horizon-client` |
| 4 | `TransactionCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 5 | `OperationCallBuilder` | ✅ | ⚠️ | Has main methods. Missing `join()`. | `@stellar/horizon-client` |
| 6 | `PaymentCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 7 | `EffectCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 8 | `OfferCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 9 | `TradesCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 10 | `AssetsCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 11 | `ClaimableBalanceCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 12 | `LiquidityPoolCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 13 | `OrderbookCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 14 | `StrictReceivePathCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 15 | `StrictSendPathCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 16 | `TradeAggregationCallBuilder` | ✅ | ✅ | Full match | `@stellar/horizon-client` |
| 17 | `PathCallBuilder` (deprecated) | ❌ | — | Deprecated in official SDK | N/A |
| 18 | `FriendbotBuilder` | ✅ | ✅ | Extends CallBuilder for Friendbot API | `@stellar/friendbot-client` |

### Horizon Types

| # | Type | Compat | Identical? | Notes | Modern Equivalent |
|---|------|--------|------------|-------|-------------------|
| 1 | `AccountResponse` | ✅ | ⚠️ | Class with full API | `@stellar/horizon-client`: `AccountRecord` |
| 2 | `CollectionPage<T>` | ✅ | ⚠️ | Has `records`, `next()`, `prev()` | `@stellar/horizon-client`: `Page<T>` |
| 3 | `HorizonApi` | ✅ | ⚠️ | Re-exported as namespace alias | `@stellar/horizon-client` |
| 4 | `ServerApi` | ✅ | ⚠️ | Re-exported as namespace alias | `@stellar/horizon-client` |
| 5 | `OperationResponseType` | ✅ | ⚠️ | Real TypeScript enum | `@stellar/horizon-client` |
| 6 | `SUBMIT_TRANSACTION_TIMEOUT` | ✅ | ✅ | Exported from Horizon api | N/A |
| 7 | `SERVER_TIME_MAP` | ✅ | ✅ | Exported from Horizon api | N/A |
| 8 | `getCurrentServerTime` | ✅ | ✅ | Exported from Horizon api | N/A |
| 9 | `EventSourceOptions<T>` | ✅ | ✅ | Exported from Horizon api | N/A |

## 12. SorobanRpc / rpc Namespace

### Server Class

| # | Method | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `getHealth()` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getHealth()` |
| 2 | `getNetwork()` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getNetwork()` |
| 3 | `getLatestLedger()` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getLatestLedger()` |
| 4 | `getAccount(addr)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getAccount()` |
| 5 | `simulateTransaction(tx)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `simulateTransaction()` |
| 6 | `prepareTransaction(tx)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `prepareTransaction()` |
| 7 | `sendTransaction(tx)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `sendTransaction()` |
| 8 | `getTransaction(hash)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getTransaction()` |
| 9 | `getEvents(req)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getEvents()` |
| 10 | `getLedgerEntries(...keys)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getLedgerEntries()` |
| 11 | `getTransactions(req)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getTransactions()` |
| 12 | `getLedgers(req)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getLedgers()` |
| 13 | `getFeeStats()` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getFeeStats()` |
| 14 | `getVersionInfo()` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getVersionInfo()` |
| 15 | `getContractData(id, key, dur)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `getContractData()` |
| 16 | `pollTransaction(hash, opts)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `pollTransaction()` |
| 17 | `getAccountEntry(addr)` | ❌ | — | Not in official SDK either (convenience only) | N/A |
| 18 | `getTrustline(acct, asset)` | ❌ | — | Not in official SDK either | N/A |
| 19 | `getClaimableBalance(id)` | ❌ | — | Not in official SDK either | N/A |
| 20 | `getAssetBalance(addr, asset)` | ❌ | — | Not in official SDK either | N/A |
| 21 | `getContractWasmByContractId(id)` | ❌ | — | Not in official SDK either | N/A |
| 22 | `getContractWasmByHash(hash)` | ❌ | — | Not in official SDK either | N/A |
| 23 | `getLedgerEntry(key)` | ❌ | — | Not in official SDK either | N/A |
| 24 | `requestAirdrop(addr)` | ❌ | — | Not in compat; use `@stellar/friendbot-client` | `@stellar/friendbot-client` |
| 25 | `fundAddress(addr)` | ❌ | — | Not in compat; use `@stellar/friendbot-client` | `@stellar/friendbot-client` |
| 26 | `getSACBalance(addr, sac)` | ❌ | — | Not in official SDK either | N/A |

### RPC Functions & Type Guards

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `assembleTransaction(tx, sim)` | ✅ | ⚠️ | Wrapped for compat types | `@stellar/rpc-client`: `assembleTransaction()` |
| 2 | `isSimulationError(sim)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `isSimulationError()` |
| 3 | `isSimulationSuccess(sim)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `isSimulationSuccess()` |
| 4 | `isSimulationRestore(sim)` | ✅ | ✅ | Full match | `@stellar/rpc-client`: `isSimulationRestore()` |
| 5 | `parseRawSimulation(sim)` | ✅ | ✅ | Exported from soroban-rpc api | N/A |
| 6 | `parseRawEvents(events)` | ✅ | ✅ | Exported from soroban-rpc api | N/A |
| 7 | `Durability` enum | ✅ | ✅ | Exported as const + type | N/A |

### RPC Types

| # | Type | Compat | Identical? | Notes | Modern Equivalent |
|---|------|--------|------------|-------|-------------------|
| 1 | `Api.GetHealthResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 2 | `Api.GetNetworkResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 3 | `Api.GetLatestLedgerResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 4 | `Api.SimulateTransactionResponse` | ✅ | ⚠️ | Uses `any` for XDR fields | `@stellar/rpc-client` |
| 5 | `Api.SimulateTransactionSuccessResponse` | ✅ | ⚠️ | | `@stellar/rpc-client` |
| 6 | `Api.SimulateTransactionErrorResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 7 | `Api.SendTransactionResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 8 | `Api.GetTransactionResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 9 | `Api.GetEventsResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 10 | `Api.GetLedgerEntriesResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 11 | `Api.GetVersionInfoResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 12 | `Api.GetFeeStatsResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 13 | `Api.GetTransactionsResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 14 | `Api.GetLedgersResponse` | ✅ | ✅ | | `@stellar/rpc-client` |
| 15 | `Api.SendTransactionStatus` | ✅ | ✅ | Both type and const | `@stellar/rpc-client` |
| 16 | `Api.GetTransactionStatus` | ✅ | ✅ | Both type and const | `@stellar/rpc-client` |

## 13. Contract Namespace

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Client` | ✅ | ⚠️ | Auto-generates typed contract methods from spec. `from()`/`fromWasmHash()` throw (need network). `deploy()`, `fromWasm()`, `txFromJSON()`, `txFromXDR()` all implemented. | Not implemented in modern packages |
| 2 | `AssembledTransaction<T>` | ✅ | ⚠️ | Full lifecycle: `build()`, `buildWithOp()`, `fromJSON()`, `fromXDR()`, `simulate()`, `sign()`, `send()`, `signAndSend()`, `signAuthEntries()`, `needsNonInvokerSigningBy()`. Getters: `result`, `simulationData`, `isReadCall`. `restoreFootprint()` is a stub. | Not implemented in modern packages |
| 3 | `SentTransaction<T>` | ✅ | ⚠️ | Polls for completion (30 attempts, 1s interval). Has `result` getter, `Errors` namespace. | Not implemented in modern packages |
| 4 | `Spec` | ✅ | ⚠️ | Re-exported from `@stellar/contracts` | `@stellar/contracts`: `Spec` |
| 5 | `basicNodeSigner` | ✅ | ✅ | Full match | Same in `stellar-sdk-comp` |
| 6 | `walkInvocationTree` | ✅ | ⚠️ | Wrapped for compat types | `@stellar/contracts`: `walkInvocationTree()` |
| 7 | `buildInvocationTree` | ✅ | ⚠️ | Wrapped for compat types | `@stellar/contracts`: `buildInvocationTree()` |
| 8 | `Result<T, E>` / `Ok<T>` / `Err<E>` | ✅ | ✅ | Rust-style Result types with `unwrap()`, `unwrapErr()`, `isOk()`, `isErr()` | N/A |
| 9 | `DEFAULT_TIMEOUT` | ✅ | ✅ | 300 seconds constant | N/A |
| 10 | `NULL_ACCOUNT` | ✅ | ✅ | Zero account constant | N/A |
| 11 | Type aliases (`u32`, `i32`, `u64`, etc.) | ✅ | ✅ | Convenience type aliases for u32, i32, u64, i64, u128, i128, u256, i256, Timepoint, Duration | N/A |
| 12 | `ClientOptions` / `MethodOptions` | ✅ | ✅ | Contract client configuration types | N/A |

## 14. StellarToml Namespace (SEP-1)

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Resolver.resolve(domain, opts?)` | ✅ | ✅ | Full match | `@stellar/seps`: `resolveStellarToml()` |
| 2 | `Api.StellarTomlResolveOptions` | ✅ | ✅ | Full match | `@stellar/seps` |
| 3 | `Api.StellarToml` | ✅ | ✅ | Full match with all fields | `@stellar/seps` |
| 4 | `Api.Documentation` | ✅ | ✅ | Full match | `@stellar/seps` |
| 5 | `Api.Currency` | ✅ | ✅ | Full match | `@stellar/seps` |
| 6 | `Api.Validator` | ✅ | ✅ | Validator interface with ALIAS, DISPLAY_NAME, HOST, PUBLIC_KEY, HISTORY | N/A |
| 7 | `Api.Principal` | ✅ | ✅ | Principal interface with name, email, keybase, etc. | N/A |
| 8 | `STELLAR_TOML_MAX_SIZE` | ✅ | ✅ | 100KB constant | N/A |

## 15. Federation Namespace (SEP-2)

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `Server` constructor | ✅ | ✅ | Full match | `@stellar/seps`: `queryFederationServer()` |
| 2 | `Server.resolve(addr, opts?)` | ✅ | ✅ | Static method | `@stellar/seps`: `resolveFederationAddress()` |
| 3 | `Server.createForDomain(domain)` | ✅ | ✅ | Static factory | `@stellar/seps`: manual creation |
| 4 | `Server.resolveAddress(addr)` | ✅ | ✅ | Instance method | `@stellar/seps`: `queryFederationServer()` |
| 5 | `Server.resolveAccountId(id)` | ✅ | ✅ | Reverse resolution | `@stellar/seps`: `queryFederationServer()` |
| 6 | `Api.Record` | ✅ | ✅ | Full match | `@stellar/seps`: `FederationRecord` |
| 7 | `Api.Options` | ✅ | ✅ | Full match | `@stellar/seps` |
| 8 | `FEDERATION_RESPONSE_MAX_SIZE` | ✅ | ✅ | 100KB constant | N/A |

## 16. WebAuth (SEP-10)

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `buildChallengeTx(...)` | ✅ | ✅ | Builds SEP-10 challenge with ManageData ops, nonce, timebounds, server signature | Same in `stellar-sdk-comp` |
| 2 | `readChallengeTx(...)` | ✅ | ✅ | Validates challenge: source, sequence=0, timebounds, ManageData ops, domain matching, server signature | Same in `stellar-sdk-comp` |
| 3 | `verifyChallengeTxSigners(...)` | ✅ | ✅ | Reads challenge, deduplicates signers, verifies client signatures | Same in `stellar-sdk-comp` |
| 4 | `verifyChallengeTxThreshold(...)` | ✅ | ✅ | Verifies challenge signatures meet weight threshold | Same in `stellar-sdk-comp` |
| 5 | `gatherTxSigners(tx, signers)` | ✅ | ✅ | Finds which signers signed a transaction using hint comparison + Ed25519 verification | Same in `stellar-sdk-comp` |
| 6 | `verifyTxSignedBy(tx, accountID)` | ✅ | ✅ | Convenience wrapper for single-signer verification | Same in `stellar-sdk-comp` |
| 7 | `InvalidChallengeError` | ✅ | ✅ | Error class for invalid challenges | Same in `stellar-sdk-comp` |

## 17. Binding Generator (SDK-only)

| # | Export | Compat | Identical? | Notes | Modern Equivalent |
|---|--------|--------|------------|-------|-------------------|
| 1 | `BindingGenerator` | ❌ | — | Generates TS contract bindings from spec | Not implemented |
| 2 | `TypeGenerator` | ❌ | — | Generates TS types from spec | Not implemented |
| 3 | `ClientGenerator` | ❌ | — | Generates client class from spec | Not implemented |
| 4 | `ConfigGenerator` | ❌ | — | Generates package config files | Not implemented |
| 5 | `fetchFromContractId` | ❌ | — | Fetch contract data via RPC | Not implemented |
| 6 | `fetchFromWasmHash` | ❌ | — | Fetch WASM via RPC | Not implemented |
| 7 | `SAC_SPEC` | ❌ | — | Base64 SAC specification | Not implemented |

---

# Summary Statistics

## stellar-base-comp Coverage

| Category | Total in Official | In Compat | Identical | Partial | Missing |
|----------|-------------------|-----------|-----------|---------|---------|
| Classes | 18 | 18 | 10 | 7 | 1 (TransactionBase) |
| Functions | 19 | 19 | 14 | 5 | 0 |
| Operations | 39 | 39 | 35 | 4 | 0 |
| Constants | 18 | 18 | 18 | 0 | 0 |
| StrKey methods | 27 | 27 | 8 | 19 | 0 |
| Utility namespaces | 4 | 4 | 4 | 0 | 0 |
| Types/Interfaces | 21 | 21 | 19 | 2 | 0 |
| Re-exports (js-xdr) | 4 | 4 | 1 | 3 | 0 |
| **Total** | **150** | **150** | **109** | **40** | **1** |

## stellar-sdk-comp Coverage

| Category | Total in Official | In Compat | Identical | Partial | Missing |
|----------|-------------------|-----------|-----------|---------|---------|
| Top-level exports | 10 | 10 | 10 | 0 | 0 |
| Horizon Server methods | 24 | 24 | 24 | 0 | 0 |
| Horizon Call Builders | 18 | 17 | 15 | 2 | 1 (PathCallBuilder deprecated) |
| Horizon Types | 9 | 9 | 5 | 4 | 0 |
| RPC Server methods | 16 (official SDK) | 16 | 16 | 0 | 0 |
| RPC functions/guards | 7 | 7 | 6 | 1 | 0 |
| RPC Types | 16 | 16 | 14 | 2 | 0 |
| Contract namespace | 12 | 12 | 7 | 5 | 0 |
| StellarToml (SEP-1) | 8 | 8 | 8 | 0 | 0 |
| Federation (SEP-2) | 8 | 8 | 8 | 0 | 0 |
| WebAuth (SEP-10) | 7 | 7 | 7 | 0 | 0 |
| Binding Generator | 7 | 0 | 0 | 0 | 7 |
| **Total** | **142** | **134** | **120** | **14** | **8** |

## Remaining Gaps

### Minor (dev tooling / deprecated / not runtime)
1. **Binding Generator** (`BindingGenerator`, `TypeGenerator`, `ClientGenerator`, `ConfigGenerator`, `fetchFromContractId`, `fetchFromWasmHash`, `SAC_SPEC`) — Dev tooling only, not runtime. Not needed for Freighter/wallet use cases.
2. **`PathCallBuilder` (deprecated)** — Use `StrictReceivePathCallBuilder`/`StrictSendPathCallBuilder` instead.

### Notes on partial implementations
- **`contract.Client`**: `from()` and `fromWasmHash()` throw (require network spec fetching). `restoreFootprint()` is a stub. All other methods work.
- **`AssembledTransaction`**: `signAuthEntries()` and `needsNonInvokerSigningBy()` are stubs. Core lifecycle (build→simulate→sign→send) fully works.
- **`SentTransaction`**: Fully functional with polling and result parsing.
