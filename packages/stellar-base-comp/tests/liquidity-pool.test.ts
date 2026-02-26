import { describe, it, expect } from 'vitest';
import { getLiquidityPoolId } from '../src/liquidity-pool.js';
import { Asset } from '../src/asset.js';

const ISSUER = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
const ISSUER2 = 'GB7TAYRUZGE6TVT7NHP5SMIZRNQA6PLM423EYISAOAP3MKYIQMVYP2JO';

describe('getLiquidityPoolId', () => {
  it('computes a 64-char hex pool ID', () => {
    const id = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
    );
    expect(typeof id).toBe('string');
    expect(id.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(id)).toBe(true);
  });

  it('produces consistent IDs', () => {
    const id1 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
    );
    const id2 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
    );
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different asset pairs', () => {
    const id1 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
    );
    const id2 = getLiquidityPoolId(
      Asset.native(),
      new Asset('EUR', ISSUER),
    );
    expect(id1).not.toBe(id2);
  });

  it('throws when assets are not in order', () => {
    expect(() =>
      getLiquidityPoolId(
        new Asset('USD', ISSUER),
        Asset.native(),
      ),
    ).toThrow(/lexicographic order/);
  });

  it('throws when assets are equal', () => {
    expect(() =>
      getLiquidityPoolId(
        new Asset('USD', ISSUER),
        new Asset('USD', ISSUER),
      ),
    ).toThrow(/lexicographic order/);
  });

  it('works with credit_alphanum4 pair', () => {
    const id = getLiquidityPoolId(
      new Asset('ARST', ISSUER2),
      new Asset('USD', ISSUER),
    );
    expect(id.length).toBe(64);
  });

  it('works with credit_alphanum4 and alphanum12 pair', () => {
    const id = getLiquidityPoolId(
      new Asset('ARST', ISSUER2),
      new Asset('LONGASSET', ISSUER),
    );
    expect(id.length).toBe(64);
  });

  it('uses default fee of 30', () => {
    const id1 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
    );
    const id2 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
      30,
    );
    expect(id1).toBe(id2);
  });

  it('different fee produces different ID', () => {
    const id1 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
      30,
    );
    const id2 = getLiquidityPoolId(
      Asset.native(),
      new Asset('USD', ISSUER),
      100,
    );
    expect(id1).not.toBe(id2);
  });
});
