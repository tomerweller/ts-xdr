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

// Top-level re-exports from @stellar/contracts (wrapped for compat types)
import {
  walkInvocationTree as _walkInvocationTree,
  buildInvocationTree as _buildInvocationTree,
} from '@stellar/contracts';
export function walkInvocationTree(root: any, callback: (node: any, depth: number) => any): void {
  const modernRoot = root?._toModern ? root._toModern() : root;
  return _walkInvocationTree(modernRoot, callback as any);
}
export function buildInvocationTree(root: any): any {
  const modernRoot = root?._toModern ? root._toModern() : root;
  return _buildInvocationTree(modernRoot);
}

// SEP-10 WebAuth
export {
  buildChallengeTx,
  readChallengeTx,
  verifyChallengeTxSigners,
  verifyChallengeTxThreshold,
  gatherTxSigners,
  verifyTxSignedBy,
  InvalidChallengeError,
} from './webauth.js';

// Error classes
export { NetworkError, BadRequestError, BadResponseError, NotFoundError } from './errors.js';

// Configuration and utilities
export { Config } from './config.js';
export { Utils } from './utils.js';

// Helpers
export { basicNodeSigner } from './basic-node-signer.js';
