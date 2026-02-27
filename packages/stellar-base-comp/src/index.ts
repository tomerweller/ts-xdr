// XDR compat runtime
export { Hyper, UnsignedHyper } from './xdr-compat/hyper.js';

// XDR namespace (all compat types)
export * as xdr from './generated/xdr-namespace.js';

// Core utilities
export { hash } from './signing.js';
export { StrKey } from './strkey.js';
export { Networks, BASE_FEE, TimeoutInfinite } from './networks.js';
export { toStroops, fromStroops } from './amount.js';

// Core classes
export { Keypair } from './keypair.js';
export { Account, MuxedAccount } from './account.js';
export { Asset } from './asset.js';
export { Memo, type MemoType } from './memo.js';

// Transaction layer
export { Operation, OperationType } from './operation.js';
export { Transaction, FeeBumpTransaction } from './transaction.js';
export { TransactionBuilder } from './transaction-builder.js';

// Additional classes
export { Claimant } from './claimant.js';
export { Contract } from './contract.js';
export { Address } from './address.js';

// Helpers
export { nativeToScVal, scValToNative } from './scval.js';
export { authorizeEntry, authorizeInvocation } from './auth.js';
export { getLiquidityPoolId } from './liquidity-pool.js';
export { SorobanDataBuilder } from './soroban-data-builder.js';

// Contract utilities (from @stellar/contracts)
export { LiquidityPoolAsset } from '@stellar/contracts';
export { ScInt } from '@stellar/contracts';
export { scValToBigInt } from '@stellar/contracts';
export { extractBaseAddress } from '@stellar/contracts';

// XdrLargeInt compat (official SDK signature: new XdrLargeInt(type, value))
export { XdrLargeInt } from './xdr-large-int.js';

// Types
export type { Signer, SignerKeyOptions } from './signer.js';
export type { AssetType } from './asset-type.js';
