import { describe, it, expect } from 'vitest';
import { Contract } from '../src/contract.js';
import { Address } from '../src/address.js';

const CONTRACT_ID =
  'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

describe('Contract', () => {
  describe('constructor', () => {
    it('creates from valid C-address', () => {
      const c = new Contract(CONTRACT_ID);
      expect(c.contractId()).toBe(CONTRACT_ID);
    });

    it('throws for non-contract address', () => {
      expect(
        () =>
          new Contract(
            'GBMZSZP7FWHX6OTYMKCUS55EHT2DECX3IIIMZP4AAMSWYX3VVAED5JVC',
          ),
      ).toThrow();
    });

    it('throws for invalid string', () => {
      expect(() => new Contract('invalid')).toThrow();
    });
  });

  describe('contractId()', () => {
    it('returns the C-address string', () => {
      const c = new Contract(CONTRACT_ID);
      expect(c.contractId()).toBe(CONTRACT_ID);
      expect(c.contractId()).toMatch(/^C/);
    });
  });

  describe('address()', () => {
    it('returns an Address wrapping the contract', () => {
      const c = new Contract(CONTRACT_ID);
      const addr = c.address();
      expect(addr).toBeInstanceOf(Address);
      expect(addr.toString()).toBe(CONTRACT_ID);
    });
  });

  describe('call()', () => {
    it('creates an invocation ScVal', () => {
      const c = new Contract(CONTRACT_ID);
      const result = c.call('transfer', { U32: 100 });
      expect(result).toBeDefined();
      expect('Vec' in result).toBe(true);
      const vec = result.Vec;
      expect(vec.length).toBe(3);
      // First element: contract address
      expect('Address' in vec[0]).toBe(true);
      // Second element: method name
      expect(vec[1]).toEqual({ Symbol: 'transfer' });
      // Third element: arg
      expect(vec[2]).toEqual({ U32: 100 });
    });

    it('creates with no args', () => {
      const c = new Contract(CONTRACT_ID);
      const result = c.call('get_balance');
      expect(result.Vec.length).toBe(2);
    });

    it('creates with multiple args', () => {
      const c = new Contract(CONTRACT_ID);
      const result = c.call('transfer', { U32: 100 }, { Bool: true });
      expect(result.Vec.length).toBe(4);
    });
  });

  describe('getFootprint()', () => {
    it('returns a LedgerKey-like object', () => {
      const c = new Contract(CONTRACT_ID);
      const fp = c.getFootprint();
      expect(fp).toBeDefined();
      expect('ContractData' in fp).toBe(true);
      expect('Contract' in fp.ContractData.contract).toBe(true);
    });
  });
});
