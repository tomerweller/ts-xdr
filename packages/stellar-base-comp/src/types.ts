/**
 * Additional type exports matching js-stellar-base.
 */

// MemoValue — the value type of Memo instances
export type MemoValue = null | string | Uint8Array;

// KeypairType — currently only ed25519
export type KeypairType = 'ed25519';

// AuthFlag — authorization flag values
export type AuthFlag = 1 | 2 | 4 | 8;

// TrustLineFlag — trust line authorization values
export type TrustLineFlag = 0 | 1 | 2;

// LiquidityPoolType — pool type identifiers
export type LiquidityPoolType = 'constant_product';

// LiquidityPoolParameters — pool parameters
export namespace LiquidityPoolParameters {
  export interface ConstantProduct {
    assetA: any;
    assetB: any;
    fee: number;
  }
}
export type LiquidityPoolParameters = LiquidityPoolParameters.ConstantProduct;

// IntLike — types that can represent an integer
export type IntLike = string | number | bigint;

// ScIntType — Soroban integer type identifiers
export type ScIntType = 'i64' | 'u64' | 'i128' | 'u128' | 'i256' | 'u256';

// SigningCallback — async signing callback for authorizeEntry
export type SigningCallback = (
  preimage: Uint8Array,
) => Promise<Uint8Array | { signature: Uint8Array; publicKey: string }>;

// InvocationWalker — callback for walkInvocationTree
export type InvocationWalker = (
  node: any,
  depth: number,
  parent?: any,
) => boolean | null | void;

// SorobanFees — fee/resource configuration
export interface SorobanFees {
  instructions: number;
  readBytes: number;
  writeBytes: number;
  resourceFee: bigint;
}

// InvocationTree types
export interface CreateInvocation {
  type: 'wasm' | 'sac';
  token?: string;
  wasm?: Uint8Array;
}

export interface ExecuteInvocation {
  source: string;
  function: string;
  args: any[];
}

export interface InvocationTree {
  type: 'execute' | 'create';
  args: CreateInvocation | ExecuteInvocation;
  invocations: InvocationTree[];
}

// OperationOptions — namespace with option interfaces for each operation
export namespace OperationOptions {
  export interface BaseOptions {
    source?: string;
  }
  export interface CreateAccount extends BaseOptions {
    destination: string;
    startingBalance: string;
  }
  export interface Payment extends BaseOptions {
    destination: string;
    asset: any;
    amount: string;
  }
  export interface PathPaymentStrictReceive extends BaseOptions {
    sendAsset: any;
    sendMax: string;
    destination: string;
    destAsset: any;
    destAmount: string;
    path?: any[];
  }
  export interface PathPaymentStrictSend extends BaseOptions {
    sendAsset: any;
    sendAmount: string;
    destination: string;
    destAsset: any;
    destMin: string;
    path?: any[];
  }
  export interface ManageSellOffer extends BaseOptions {
    selling: any;
    buying: any;
    amount: string;
    price: string | { n: number; d: number };
    offerId?: string;
  }
  export interface ManageBuyOffer extends BaseOptions {
    selling: any;
    buying: any;
    buyAmount: string;
    price: string | { n: number; d: number };
    offerId?: string;
  }
  export interface CreatePassiveSellOffer extends BaseOptions {
    selling: any;
    buying: any;
    amount: string;
    price: string | { n: number; d: number };
  }
  export interface SetOptions extends BaseOptions {
    inflationDest?: string;
    clearFlags?: number;
    setFlags?: number;
    masterWeight?: number;
    lowThreshold?: number;
    medThreshold?: number;
    highThreshold?: number;
    homeDomain?: string;
    signer?: any;
  }
  export interface ChangeTrust extends BaseOptions {
    asset: any;
    limit?: string;
  }
  export interface AllowTrust extends BaseOptions {
    trustor: string;
    assetCode: string;
    authorize?: number;
  }
  export interface AccountMerge extends BaseOptions {
    destination: string;
  }
  export interface Inflation extends BaseOptions {}
  export interface ManageData extends BaseOptions {
    name: string;
    value: Uint8Array | string | null;
  }
  export interface BumpSequence extends BaseOptions {
    bumpTo: string;
  }
  export interface CreateClaimableBalance extends BaseOptions {
    asset: any;
    amount: string;
    claimants: any[];
  }
  export interface ClaimClaimableBalance extends BaseOptions {
    balanceId: string;
  }
  export interface BeginSponsoringFutureReserves extends BaseOptions {
    sponsoredId: string;
  }
  export interface RevokeAccountSponsorship extends BaseOptions {
    account: string;
  }
  export interface RevokeTrustlineSponsorship extends BaseOptions {
    account: string;
    asset: any;
  }
  export interface RevokeOfferSponsorship extends BaseOptions {
    seller: string;
    offerId: string;
  }
  export interface RevokeDataSponsorship extends BaseOptions {
    account: string;
    name: string;
  }
  export interface RevokeClaimableBalanceSponsorship extends BaseOptions {
    balanceId: string;
  }
  export interface RevokeLiquidityPoolSponsorship extends BaseOptions {
    liquidityPoolId: string;
  }
  export interface RevokeSignerSponsorship extends BaseOptions {
    account: string;
    signer: any;
  }
  export interface Clawback extends BaseOptions {
    asset: any;
    from: string;
    amount: string;
  }
  export interface ClawbackClaimableBalance extends BaseOptions {
    balanceId: string;
  }
  export interface SetTrustLineFlags extends BaseOptions {
    trustor: string;
    asset: any;
    flags?: { authorized?: boolean; authorizedToMaintainLiabilities?: boolean; clawbackEnabled?: boolean };
    clearFlags?: number;
    setFlags?: number;
  }
  export interface LiquidityPoolDeposit extends BaseOptions {
    liquidityPoolId: string;
    maxAmountA: string;
    maxAmountB: string;
    minPrice: string | { n: number; d: number };
    maxPrice: string | { n: number; d: number };
  }
  export interface LiquidityPoolWithdraw extends BaseOptions {
    liquidityPoolId: string;
    amount: string;
    minAmountA: string;
    minAmountB: string;
  }
  export interface InvokeHostFunction extends BaseOptions {
    func: any;
    auth?: any[];
  }
  export interface ExtendFootprintTTL extends BaseOptions {
    extendTo: number;
  }
  export interface RestoreFootprint extends BaseOptions {}
  export interface CreateStellarAssetContract extends BaseOptions {
    asset: any;
  }
  export interface InvokeContractFunction extends BaseOptions {
    contract: string;
    function: string;
    args: any[];
    auth?: any[];
  }
  export interface CreateCustomContract extends BaseOptions {
    address: any;
    wasmHash: Uint8Array;
    constructorArgs?: any[];
    salt?: Uint8Array;
    auth?: any[];
  }
  export interface UploadContractWasm extends BaseOptions {
    wasm: Uint8Array;
  }
}
