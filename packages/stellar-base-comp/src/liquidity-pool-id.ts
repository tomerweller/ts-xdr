/**
 * LiquidityPoolId class matching js-stellar-base.
 * Wraps a pool ID hex string for TrustLine operations.
 */

export class LiquidityPoolId {
  private readonly _poolId: string;

  constructor(liquidityPoolId: string) {
    if (!/^[0-9a-f]{64}$/i.test(liquidityPoolId)) {
      throw new Error('Invalid liquidity pool ID (expected 64-char hex)');
    }
    this._poolId = liquidityPoolId.toLowerCase();
  }

  static fromOperation(tlAssetXdr: any): LiquidityPoolId {
    // Handle modern XDR TrustLineAsset with LiquidityPoolId arm
    if (tlAssetXdr.LiquidityPoolId) {
      const bytes: Uint8Array = tlAssetXdr.LiquidityPoolId;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return new LiquidityPoolId(hex);
    }
    // Handle compat XDR with accessor
    if (typeof tlAssetXdr.liquidityPoolId === 'function') {
      const bytes = tlAssetXdr.liquidityPoolId();
      const hex = Array.from(bytes as Uint8Array, b => b.toString(16).padStart(2, '0')).join('');
      return new LiquidityPoolId(hex);
    }
    throw new Error('Cannot extract LiquidityPoolId from XDR');
  }

  toXDRObject(): any {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(this._poolId.slice(i * 2, i * 2 + 2), 16);
    }
    return { LiquidityPoolId: bytes };
  }

  getLiquidityPoolId(): string {
    return this._poolId;
  }

  getAssetType(): string {
    return 'liquidity_pool_shares';
  }

  equals(other: LiquidityPoolId): boolean {
    return this._poolId === other._poolId;
  }

  toString(): string {
    return `liquidity_pool:${this._poolId}`;
  }
}
