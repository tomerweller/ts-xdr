import { describe, it, expect } from 'vitest';
import { SorobanDataBuilder } from '../src/soroban-data-builder.js';

describe('SorobanDataBuilder', () => {
  describe('constructor', () => {
    it('creates with default empty data', () => {
      const builder = new SorobanDataBuilder();
      const data = builder.build();
      expect(data).toBeDefined();
      expect(data.resources.footprint.readOnly).toEqual([]);
      expect(data.resources.footprint.readWrite).toEqual([]);
      expect(data.resources.instructions).toBe(0);
      expect(data.resources.diskReadBytes).toBe(0);
      expect(data.resources.writeBytes).toBe(0);
      expect(data.resourceFee).toBe(0n);
    });
  });

  describe('setResources', () => {
    it('sets resource values', () => {
      const data = new SorobanDataBuilder()
        .setResources(1000, 2000, 3000)
        .build();
      expect(data.resources.instructions).toBe(1000);
      expect(data.resources.diskReadBytes).toBe(2000);
      expect(data.resources.writeBytes).toBe(3000);
    });
  });

  describe('setResourceFee', () => {
    it('sets fee as bigint', () => {
      const data = new SorobanDataBuilder().setResourceFee(12345n).build();
      expect(data.resourceFee).toBe(12345n);
    });

    it('sets fee as string', () => {
      const data = new SorobanDataBuilder().setResourceFee('99999').build();
      expect(data.resourceFee).toBe(99999n);
    });

    it('sets fee as number', () => {
      const data = new SorobanDataBuilder().setResourceFee(42).build();
      expect(data.resourceFee).toBe(42n);
    });
  });

  describe('setFootprint', () => {
    it('sets read-only and read-write', () => {
      const readOnly = [{ Account: { PublicKeyTypeEd25519: new Uint8Array(32) } }] as any;
      const readWrite = [{ Account: { PublicKeyTypeEd25519: new Uint8Array(32) } }] as any;
      const data = new SorobanDataBuilder()
        .setFootprint(readOnly, readWrite)
        .build();
      expect(data.resources.footprint.readOnly.length).toBe(1);
      expect(data.resources.footprint.readWrite.length).toBe(1);
    });
  });

  describe('setReadOnly', () => {
    it('sets read-only without changing read-write', () => {
      const readOnly = [{ Account: { PublicKeyTypeEd25519: new Uint8Array(32) } }] as any;
      const data = new SorobanDataBuilder().setReadOnly(readOnly).build();
      expect(data.resources.footprint.readOnly.length).toBe(1);
      expect(data.resources.footprint.readWrite.length).toBe(0);
    });
  });

  describe('setReadWrite', () => {
    it('sets read-write without changing read-only', () => {
      const readWrite = [{ Account: { PublicKeyTypeEd25519: new Uint8Array(32) } }] as any;
      const data = new SorobanDataBuilder().setReadWrite(readWrite).build();
      expect(data.resources.footprint.readOnly.length).toBe(0);
      expect(data.resources.footprint.readWrite.length).toBe(1);
    });
  });

  describe('method chaining', () => {
    it('supports fluent API', () => {
      const data = new SorobanDataBuilder()
        .setResources(100, 200, 300)
        .setResourceFee(500n)
        .build();
      expect(data.resources.instructions).toBe(100);
      expect(data.resourceFee).toBe(500n);
    });
  });
});
