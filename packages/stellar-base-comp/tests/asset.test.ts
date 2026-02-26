import { describe, it, expect } from 'vitest';
import { Asset } from '../src/asset.js';

const ISSUER = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
const ISSUER2 = 'GB7TAYRUZGE6TVT7NHP5SMIZRNQA6PLM423EYISAOAP3MKYIQMVYP2JO';

describe('Asset', () => {
  describe('constructor', () => {
    it("throws when there's no issuer for non-XLM asset", () => {
      expect(() => new Asset('USD')).toThrow(/Issuer cannot be null/);
    });

    it('throws when code is invalid', () => {
      expect(() => new Asset('', ISSUER)).toThrow(/Asset code is invalid/);
      expect(() => new Asset('1234567890123', ISSUER)).toThrow(
        /Asset code is invalid/,
      );
      expect(() => new Asset('ab_', ISSUER)).toThrow(/Asset code is invalid/);
    });

    it('throws when issuer is invalid', () => {
      expect(() => new Asset('USD', 'GCEZWKCA5')).toThrow(/Issuer is invalid/);
    });
  });

  describe('native()', () => {
    it('creates native asset', () => {
      const a = Asset.native();
      expect(a.isNative()).toBe(true);
      expect(a.getCode()).toBe('XLM');
      expect(a.getIssuer()).toBeUndefined();
      expect(a.getAssetType()).toBe('native');
    });
  });

  describe('getCode()', () => {
    it("returns 'XLM' for native", () => {
      expect(Asset.native().getCode()).toBe('XLM');
    });

    it('returns code for non-native', () => {
      expect(new Asset('USD', ISSUER).getCode()).toBe('USD');
    });
  });

  describe('getIssuer()', () => {
    it('returns undefined for native', () => {
      expect(Asset.native().getIssuer()).toBeUndefined();
    });

    it('returns issuer for non-native', () => {
      expect(new Asset('USD', ISSUER).getIssuer()).toBe(ISSUER);
    });
  });

  describe('getAssetType()', () => {
    it("returns 'native' for native", () => {
      expect(Asset.native().getAssetType()).toBe('native');
    });

    it("returns 'credit_alphanum4' for 1-4 char codes", () => {
      expect(new Asset('A', ISSUER).getAssetType()).toBe('credit_alphanum4');
      expect(new Asset('AB', ISSUER).getAssetType()).toBe('credit_alphanum4');
      expect(new Asset('ABC', ISSUER).getAssetType()).toBe('credit_alphanum4');
      expect(new Asset('ABCD', ISSUER).getAssetType()).toBe(
        'credit_alphanum4',
      );
    });

    it("returns 'credit_alphanum12' for 5-12 char codes", () => {
      expect(new Asset('ABCDE', ISSUER).getAssetType()).toBe(
        'credit_alphanum12',
      );
      expect(new Asset('ABCDEF', ISSUER).getAssetType()).toBe(
        'credit_alphanum12',
      );
      expect(new Asset('123456789012', ISSUER).getAssetType()).toBe(
        'credit_alphanum12',
      );
    });
  });

  describe('toXDRObject()', () => {
    it('creates XDR for native asset', () => {
      const asset = Asset.native();
      const xdr = asset.toXDRObject();
      expect(xdr).toBeDefined();
      expect(xdr.switch().name).toBe('assetTypeNative');
    });

    it('creates XDR for credit_alphanum4', () => {
      const asset = new Asset('USD', ISSUER);
      const xdr = asset.toXDRObject();
      expect(xdr).toBeDefined();
      expect(xdr.arm()).toBe('alphaNum4');
    });

    it('creates XDR for credit_alphanum12', () => {
      const asset = new Asset('LONGASSET', ISSUER);
      const xdr = asset.toXDRObject();
      expect(xdr).toBeDefined();
      expect(xdr.arm()).toBe('alphaNum12');
    });
  });

  describe('fromOperation()', () => {
    it('parses native asset XDR', () => {
      const asset = Asset.native();
      const xdr = asset.toXDRObject();
      const back = Asset.fromOperation(xdr);
      expect(back.isNative()).toBe(true);
    });

    it('parses alphanum4 asset XDR', () => {
      const asset = new Asset('USD', ISSUER);
      const xdr = asset.toXDRObject();
      const back = Asset.fromOperation(xdr);
      expect(back.getCode()).toBe('USD');
      expect(back.getIssuer()).toBe(ISSUER);
    });

    it('parses alphanum12 asset XDR', () => {
      const asset = new Asset('KHLTOKEN', ISSUER);
      const xdr = asset.toXDRObject();
      const back = Asset.fromOperation(xdr);
      expect(back.getCode()).toBe('KHLTOKEN');
      expect(back.getIssuer()).toBe(ISSUER);
    });
  });

  describe('toString()', () => {
    it("returns 'native' for native asset", () => {
      expect(Asset.native().toString()).toBe('native');
    });

    it("returns 'code:issuer' for non-native asset", () => {
      const asset = new Asset('USD', ISSUER);
      expect(asset.toString()).toBe(`USD:${ISSUER}`);
    });
  });

  describe('equals()', () => {
    it('returns true for identical assets', () => {
      const a = new Asset('USD', ISSUER);
      const b = new Asset('USD', ISSUER);
      expect(a.equals(b)).toBe(true);
    });

    it('returns true for native equality', () => {
      expect(Asset.native().equals(Asset.native())).toBe(true);
    });

    it('returns false for different codes', () => {
      const a = new Asset('USD', ISSUER);
      const b = new Asset('EUR', ISSUER);
      expect(a.equals(b)).toBe(false);
    });

    it('returns false for different issuers', () => {
      const a = new Asset('USD', ISSUER);
      const b = new Asset('USD', ISSUER2);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('compare()', () => {
    it('returns 0 for equal assets', () => {
      expect(Asset.compare(Asset.native(), Asset.native())).toBe(0);
      const a = new Asset('USD', ISSUER);
      expect(Asset.compare(a, a)).toBe(0);
    });

    it('orders native < alphanum4 < alphanum12', () => {
      const xlm = Asset.native();
      const anum4 = new Asset('ARST', ISSUER2);
      const anum12 = new Asset('ARSTANUM12', ISSUER2);

      expect(Asset.compare(xlm, xlm)).toBe(0);
      expect(Asset.compare(xlm, anum4)).toBe(-1);
      expect(Asset.compare(xlm, anum12)).toBe(-1);

      expect(Asset.compare(anum4, xlm)).toBe(1);
      expect(Asset.compare(anum4, anum4)).toBe(0);
      expect(Asset.compare(anum4, anum12)).toBe(-1);

      expect(Asset.compare(anum12, xlm)).toBe(1);
      expect(Asset.compare(anum12, anum4)).toBe(1);
      expect(Asset.compare(anum12, anum12)).toBe(0);
    });

    it('orders codes alphabetically (byte order)', () => {
      const arst = new Asset('ARST', ISSUER2);
      const usda = new Asset('USDA', ISSUER2);

      expect(Asset.compare(arst, arst)).toBe(0);
      expect(Asset.compare(arst, usda)).toBe(-1);
      expect(Asset.compare(usda, arst)).toBe(1);
    });

    it('uppercase codes sort before lowercase', () => {
      const upper = new Asset(
        'B',
        'GA7NLOF4EHWMJF6DBXXV2H6AYI7IHYWNFZR6R52BYBLY7TE5Q74AIDRA',
      );
      const lower = new Asset(
        'a',
        'GA7NLOF4EHWMJF6DBXXV2H6AYI7IHYWNFZR6R52BYBLY7TE5Q74AIDRA',
      );
      expect(Asset.compare(upper, lower)).toBe(-1);
    });

    it('orders issuers when codes match', () => {
      const a = new Asset('ARST', ISSUER2);
      const b = new Asset('ARST', ISSUER);

      expect(Asset.compare(a, b)).toBe(-1);
      expect(Asset.compare(b, a)).toBe(1);
    });

    it('instance compare works too', () => {
      const native = Asset.native();
      const usd = new Asset('USD', ISSUER);
      expect(native.compare(usd)).toBeLessThan(0);
      expect(usd.compare(native)).toBeGreaterThan(0);
    });
  });

  describe('roundtrip through modern', () => {
    it('roundtrips credit asset', () => {
      const a = new Asset('USD', ISSUER);
      const modern = a._toModern();
      const back = Asset._fromModern(modern);
      expect(back.getCode()).toBe('USD');
      expect(back.getIssuer()).toBe(ISSUER);
    });

    it('roundtrips native', () => {
      const a = Asset.native();
      const modern = a._toModern();
      const back = Asset._fromModern(modern);
      expect(back.isNative()).toBe(true);
    });
  });
});
