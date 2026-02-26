/**
 * Hand-written Stellar XDR types — minimal subset needed for rs-stellar-xdr
 * compatibility tests. These mirror what the xdrgen TypeScript backend would
 * generate from the Stellar .x schema files.
 *
 * SEP-0051 aligned: snake_case fields, externally-tagged unions, null optionals.
 *
 * Source: https://github.com/nickmccurdy/xdr/tree/master/Stellar
 */
import {
  int32,
  uint32,
  int64,
  uint64,
  bool,
  fixedOpaque,
  varOpaque,
  xdrString,
  fixedArray,
  varArray,
  option,
  xdrStruct,
  xdrEnum,
  taggedUnion,
  type XdrCodec,
} from '../../src/index.js';

// ============================================================
// Primitive typedefs
// ============================================================

export type Uint256 = Uint8Array;
export const Uint256: XdrCodec<Uint256> = fixedOpaque(32);

export type Hash = Uint8Array;
export const Hash: XdrCodec<Hash> = fixedOpaque(32);

export type SignatureHint = Uint8Array;
export const SignatureHint: XdrCodec<SignatureHint> = fixedOpaque(4);

export type Signature = Uint8Array;
export const Signature: XdrCodec<Signature> = varOpaque(64);

export type AssetCode4 = Uint8Array;
export const AssetCode4: XdrCodec<AssetCode4> = fixedOpaque(4);

export type AssetCode12 = Uint8Array;
export const AssetCode12: XdrCodec<AssetCode12> = fixedOpaque(12);

export type SequenceNumber = bigint;
export const SequenceNumber: XdrCodec<SequenceNumber> = int64;

export type TimePoint = bigint;
export const TimePoint: XdrCodec<TimePoint> = uint64;

export type Int64 = bigint;
export const Int64: XdrCodec<Int64> = int64;

// ============================================================
// PublicKey
// ============================================================

export type PublicKeyType = 'ed25519';
export const PublicKeyType = xdrEnum({
  ed25519: 0,
});

export type PublicKey = { readonly ed25519: Uint8Array };
export const PublicKey: XdrCodec<PublicKey> = taggedUnion({
  switchOn: PublicKeyType,
  arms: [{ tags: ['ed25519'], codec: Uint256 }],
}) as XdrCodec<PublicKey>;

export type AccountId = PublicKey;
export const AccountId: XdrCodec<AccountId> = PublicKey;

// ============================================================
// CryptoKeyType / MuxedAccount
// ============================================================

export type CryptoKeyType =
  | 'ed25519'
  | 'pre_auth_tx'
  | 'hash_x'
  | 'ed25519_signed_payload'
  | 'muxed_ed25519';
export const CryptoKeyType = xdrEnum({
  ed25519: 0,
  pre_auth_tx: 1,
  hash_x: 2,
  ed25519_signed_payload: 3,
  muxed_ed25519: 0x100,
});

export interface MuxedAccountMed25519 {
  readonly id: bigint;
  readonly ed25519: Uint8Array;
}
export const MuxedAccountMed25519: XdrCodec<MuxedAccountMed25519> =
  xdrStruct<MuxedAccountMed25519>([
    ['id', uint64],
    ['ed25519', Uint256],
  ]);

export type MuxedAccount =
  | { readonly ed25519: Uint8Array }
  | { readonly muxed_ed25519: MuxedAccountMed25519 };
export const MuxedAccount: XdrCodec<MuxedAccount> = taggedUnion({
  switchOn: CryptoKeyType,
  arms: [
    { tags: ['ed25519'], codec: Uint256 },
    { tags: ['muxed_ed25519'], codec: MuxedAccountMed25519 },
  ],
}) as XdrCodec<MuxedAccount>;

// ============================================================
// TimeBounds / Preconditions
// ============================================================

export interface TimeBounds {
  readonly min_time: bigint;
  readonly max_time: bigint;
}
export const TimeBounds: XdrCodec<TimeBounds> = xdrStruct<TimeBounds>([
  ['min_time', TimePoint],
  ['max_time', TimePoint],
]);

export type PreconditionType = 'none' | 'time' | 'v2';
export const PreconditionType = xdrEnum({
  none: 0,
  time: 1,
  v2: 2,
});

// Simplified: only None and Time arms (V2 omitted for test subset)
export type Preconditions =
  | 'none'
  | { readonly time: TimeBounds };
export const Preconditions: XdrCodec<Preconditions> = taggedUnion({
  switchOn: PreconditionType,
  arms: [
    { tags: ['none'] },
    { tags: ['time'], codec: TimeBounds },
  ],
}) as XdrCodec<Preconditions>;

// ============================================================
// Memo
// ============================================================

export type MemoType = 'none' | 'text' | 'id' | 'hash' | 'return';
export const MemoType = xdrEnum({
  none: 0,
  text: 1,
  id: 2,
  hash: 3,
  return: 4,
});

export type Memo =
  | 'none'
  | { readonly text: string }
  | { readonly id: bigint }
  | { readonly hash: Uint8Array }
  | { readonly return: Uint8Array };
export const Memo: XdrCodec<Memo> = taggedUnion({
  switchOn: MemoType,
  arms: [
    { tags: ['none'] },
    { tags: ['text'], codec: xdrString(28) },
    { tags: ['id'], codec: uint64 },
    { tags: ['hash'], codec: Hash },
    { tags: ['return'], codec: Hash },
  ],
}) as XdrCodec<Memo>;

// ============================================================
// Asset types
// ============================================================

export type AssetType =
  | 'native'
  | 'credit_alphanum4'
  | 'credit_alphanum12'
  | 'pool_share';
export const AssetType = xdrEnum({
  native: 0,
  credit_alphanum4: 1,
  credit_alphanum12: 2,
  pool_share: 3,
});

export interface AlphaNum4 {
  readonly asset_code: Uint8Array;
  readonly issuer: AccountId;
}
export const AlphaNum4: XdrCodec<AlphaNum4> = xdrStruct<AlphaNum4>([
  ['asset_code', AssetCode4],
  ['issuer', AccountId],
]);

export interface AlphaNum12 {
  readonly asset_code: Uint8Array;
  readonly issuer: AccountId;
}
export const AlphaNum12: XdrCodec<AlphaNum12> = xdrStruct<AlphaNum12>([
  ['asset_code', AssetCode12],
  ['issuer', AccountId],
]);

export type Asset =
  | 'native'
  | { readonly credit_alphanum4: AlphaNum4 }
  | { readonly credit_alphanum12: AlphaNum12 };
export const Asset: XdrCodec<Asset> = taggedUnion({
  switchOn: AssetType,
  arms: [
    { tags: ['native'] },
    { tags: ['credit_alphanum4'], codec: AlphaNum4 },
    { tags: ['credit_alphanum12'], codec: AlphaNum12 },
  ],
}) as XdrCodec<Asset>;

// ============================================================
// Operations
// ============================================================

export type OperationType =
  | 'create_account'
  | 'payment'
  | 'change_trust';
export const OperationType = xdrEnum({
  create_account: 0,
  payment: 1,
  change_trust: 6,
});

export interface CreateAccountOp {
  readonly destination: AccountId;
  readonly starting_balance: bigint;
}
export const CreateAccountOp: XdrCodec<CreateAccountOp> =
  xdrStruct<CreateAccountOp>([
    ['destination', AccountId],
    ['starting_balance', Int64],
  ]);

export interface PaymentOp {
  readonly destination: MuxedAccount;
  readonly asset: Asset;
  readonly amount: bigint;
}
export const PaymentOp: XdrCodec<PaymentOp> = xdrStruct<PaymentOp>([
  ['destination', MuxedAccount],
  ['asset', Asset],
  ['amount', Int64],
]);

// ChangeTrustAsset — simplified (only native & credit types)
export type ChangeTrustAsset =
  | 'native'
  | { readonly credit_alphanum4: AlphaNum4 }
  | { readonly credit_alphanum12: AlphaNum12 }
  | 'pool_share';
export const ChangeTrustAsset: XdrCodec<ChangeTrustAsset> = taggedUnion({
  switchOn: AssetType,
  arms: [
    { tags: ['native'] },
    { tags: ['credit_alphanum4'], codec: AlphaNum4 },
    { tags: ['credit_alphanum12'], codec: AlphaNum12 },
    { tags: ['pool_share'] }, // void arm for completeness
  ],
}) as XdrCodec<ChangeTrustAsset>;

export interface ChangeTrustOp {
  readonly line: ChangeTrustAsset;
  readonly limit: bigint;
}
export const ChangeTrustOp: XdrCodec<ChangeTrustOp> =
  xdrStruct<ChangeTrustOp>([
    ['line', ChangeTrustAsset],
    ['limit', Int64],
  ]);

export type OperationBody =
  | { readonly create_account: CreateAccountOp }
  | { readonly payment: PaymentOp }
  | { readonly change_trust: ChangeTrustOp };
export const OperationBody: XdrCodec<OperationBody> = taggedUnion({
  switchOn: OperationType,
  arms: [
    { tags: ['create_account'], codec: CreateAccountOp },
    { tags: ['payment'], codec: PaymentOp },
    { tags: ['change_trust'], codec: ChangeTrustOp },
  ],
}) as XdrCodec<OperationBody>;

export interface Operation {
  readonly source_account: MuxedAccount | null;
  readonly body: OperationBody;
}
export const Operation: XdrCodec<Operation> = xdrStruct<Operation>([
  ['source_account', option(MuxedAccount)],
  ['body', OperationBody],
]);

// ============================================================
// Transaction
// ============================================================

export type TransactionExt = 'v0';
export const TransactionExt: XdrCodec<TransactionExt> = taggedUnion({
  switchOn: int32,
  arms: [{ tags: [0], key: 'v0' }],
}) as XdrCodec<TransactionExt>;

export interface Transaction {
  readonly source_account: MuxedAccount;
  readonly fee: number;
  readonly seq_num: bigint;
  readonly cond: Preconditions;
  readonly memo: Memo;
  readonly operations: readonly Operation[];
  readonly ext: TransactionExt;
}
export const Transaction: XdrCodec<Transaction> = xdrStruct<Transaction>([
  ['source_account', MuxedAccount],
  ['fee', uint32],
  ['seq_num', SequenceNumber],
  ['cond', Preconditions],
  ['memo', Memo],
  ['operations', varArray(100, Operation)],
  ['ext', TransactionExt],
]);

// ============================================================
// DecoratedSignature / Envelope
// ============================================================

export interface DecoratedSignature {
  readonly hint: Uint8Array;
  readonly signature: Uint8Array;
}
export const DecoratedSignature: XdrCodec<DecoratedSignature> =
  xdrStruct<DecoratedSignature>([
    ['hint', SignatureHint],
    ['signature', Signature],
  ]);

export interface TransactionV1Envelope {
  readonly tx: Transaction;
  readonly signatures: readonly DecoratedSignature[];
}
export const TransactionV1Envelope: XdrCodec<TransactionV1Envelope> =
  xdrStruct<TransactionV1Envelope>([
    ['tx', Transaction],
    ['signatures', varArray(20, DecoratedSignature)],
  ]);

export type EnvelopeType =
  | 'tx_v0'
  | 'scp'
  | 'tx'
  | 'auth'
  | 'scp_value'
  | 'tx_fee_bump'
  | 'op_id'
  | 'pool_revoke_op_id'
  | 'contract_id'
  | 'soroban_authorization';
export const EnvelopeType = xdrEnum({
  tx_v0: 0,
  scp: 1,
  tx: 2,
  auth: 3,
  scp_value: 4,
  tx_fee_bump: 5,
  op_id: 6,
  pool_revoke_op_id: 7,
  contract_id: 8,
  soroban_authorization: 9,
});

// Simplified: only Tx arm (V0 and FeeBump omitted for test subset)
export type TransactionEnvelope = {
  readonly tx: TransactionV1Envelope;
};
export const TransactionEnvelope: XdrCodec<TransactionEnvelope> = taggedUnion({
  switchOn: EnvelopeType,
  arms: [{ tags: ['tx'], codec: TransactionV1Envelope }],
}) as XdrCodec<TransactionEnvelope>;

// ============================================================
// Uint32 / Int64 as named types (for default value tests)
// ============================================================

export type Uint32 = number;
export const Uint32: XdrCodec<Uint32> = uint32;
