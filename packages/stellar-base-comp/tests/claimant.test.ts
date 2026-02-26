import { describe, it, expect } from 'vitest';
import { Claimant } from '../src/claimant.js';

const DEST = 'GAT4KBPBCPTOLGILH5NNTBWSXHEBUTRQMEUSQGSPCCFM4QHO2COADB5O';
const PUBKEY2 = 'GABHZBLQHGDTFYSS7O52RQCQBL7GTURQM5WXFU2ZFXSIGBN4BEYOOOMZ';

describe('Claimant', () => {
  describe('constructor', () => {
    it('creates with unconditional predicate by default', () => {
      const c = new Claimant(DEST);
      expect(c.destination).toBe(DEST);
      expect(c.predicate).toBe('Unconditional');
    });

    it('creates with explicit unconditional predicate', () => {
      const c = new Claimant(DEST, Claimant.predicateUnconditional());
      expect(c.predicate).toBe('Unconditional');
    });

    it('creates with explicit destination', () => {
      const c = new Claimant(PUBKEY2);
      expect(c.destination).toBe(PUBKEY2);
    });
  });

  describe('predicate builders', () => {
    it('predicateUnconditional', () => {
      expect(Claimant.predicateUnconditional()).toBe('Unconditional');
    });

    it('predicateBeforeAbsoluteTime', () => {
      const pred = Claimant.predicateBeforeAbsoluteTime('1234567890');
      expect(pred).toEqual({ BeforeAbsoluteTime: 1234567890n });
    });

    it('predicateBeforeRelativeTime', () => {
      const pred = Claimant.predicateBeforeRelativeTime('86400');
      expect(pred).toEqual({ BeforeRelativeTime: 86400n });
    });

    it('predicateAnd', () => {
      const p1 = Claimant.predicateBeforeAbsoluteTime('1000');
      const p2 = Claimant.predicateBeforeRelativeTime('500');
      const pred = Claimant.predicateAnd(p1, p2);
      expect(pred).toEqual({ And: [p1, p2] });
    });

    it('predicateOr', () => {
      const p1 = Claimant.predicateUnconditional();
      const p2 = Claimant.predicateBeforeAbsoluteTime('2000');
      const pred = Claimant.predicateOr(p1, p2);
      expect(pred).toEqual({ Or: [p1, p2] });
    });

    it('predicateNot', () => {
      const p = Claimant.predicateBeforeAbsoluteTime('3000');
      const pred = Claimant.predicateNot(p);
      expect(pred).toEqual({ Not: p });
    });

    it('nested predicates', () => {
      const pred = Claimant.predicateAnd(
        Claimant.predicateOr(
          Claimant.predicateBeforeAbsoluteTime('1000'),
          Claimant.predicateBeforeRelativeTime('500'),
        ),
        Claimant.predicateNot(Claimant.predicateUnconditional()),
      );
      expect(pred).toEqual({
        And: [
          {
            Or: [
              { BeforeAbsoluteTime: 1000n },
              { BeforeRelativeTime: 500n },
            ],
          },
          { Not: 'Unconditional' },
        ],
      });
    });
  });

  describe('_toModern', () => {
    it('converts to modern claimant', () => {
      const c = new Claimant(DEST);
      const modern = c._toModern();
      expect('ClaimantTypeV0' in modern).toBe(true);
      expect(modern.ClaimantTypeV0.predicate).toBe('Unconditional');
    });

    it('converts with time predicate', () => {
      const c = new Claimant(
        DEST,
        Claimant.predicateBeforeAbsoluteTime('1000000'),
      );
      const modern = c._toModern();
      expect(modern.ClaimantTypeV0.predicate).toEqual({
        BeforeAbsoluteTime: 1000000n,
      });
    });
  });
});
