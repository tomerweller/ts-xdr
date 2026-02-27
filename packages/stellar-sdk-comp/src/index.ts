// Re-export everything from stellar-base-comp
export * from '@stellar/stellar-base-comp';

// SorobanRpc namespace (official SDK exports as `rpc`, Freighter aliases to SorobanRpc)
export * as SorobanRpc from './soroban-rpc/index.js';
export * as rpc from './soroban-rpc/index.js';

// Horizon namespace
export * as Horizon from './horizon/index.js';

// StellarToml namespace (SEP-1)
export * as StellarToml from './stellar-toml/index.js';

// Federation namespace (SEP-2)
export * as Federation from './federation/index.js';

// SEP-29
export { AccountRequiresMemoError } from '@stellar/seps';

// Contract namespace
export * as contract from './contract/index.js';

// Top-level re-exports from @stellar/contracts
export { walkInvocationTree, buildInvocationTree } from '@stellar/contracts';

// Helpers
export { basicNodeSigner } from './basic-node-signer.js';
