/**
 * The `xdr` namespace object — collects all compat XDR types into a single
 * object matching js-stellar-base's `xdr` export.
 *
 * Re-exports everything from the generated stellar_compat.ts which provides
 * typed interfaces, runtime registrations, and typed exports for all XDR types.
 */

export * from './stellar_compat.js';
