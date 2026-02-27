/**
 * createCompatUnion — factory for compat union classes.
 *
 * Creates a class with:
 * - Static factories per arm: Union.armName(value?)
 * - Instance methods: .switch(), .arm(), .value()
 * - Per-arm accessors: .armName() → value
 * - _toModern() / static _fromModern(v) for conversion
 * - toXDR/fromXDR/validateXDR inherited
 */

import type { XdrCodec } from '@stellar/xdr';
import { XdrTypeBase } from './base.js';
import type { Converter } from './converters.js';

export interface UnionArmConfig {
  /** Compat switch value names/numbers that map to this arm (e.g. ['assetTypeNative'] or [0, 1]) */
  switchValues: (string | number)[];
  /** Modern arm key (e.g. 'Native' or 0) */
  modern: string | number;
  /** Arm accessor name — omit for void arms (e.g. 'alphaNum4') */
  arm?: string;
  /** Converter for the arm value — omit for void arms */
  convert?: Converter<any, any>;
}

export interface CompatUnionConfig {
  codec: XdrCodec<any>;
  switchEnum: any | null; // CompatEnumClass or null for int-discriminated unions
  arms: UnionArmConfig[];
}

export interface CompatUnionClass {
  new (switchVal: any, armName: string | undefined, armValue: any): any;
  _codec: XdrCodec<any>;
  _fromModern(modern: any): any;
  fromXDR(input: Uint8Array | string, format?: string): any;
  validateXDR(input: Uint8Array | string, format?: string): boolean;
  [key: string]: any; // static factories
}

export function createCompatUnion(config: CompatUnionConfig): CompatUnionClass {
  const { codec, switchEnum, arms } = config;

  const isIntDiscriminant = switchEnum === null;

  // Build lookup maps
  // switchCompat → arm config (key is string for enum, string|number for int)
  const switchToArm = new Map<string | number, UnionArmConfig>();
  // modern key → arm config
  const modernToArm = new Map<string | number, UnionArmConfig>();
  // arm accessor name → arm config
  const armNameToConfig = new Map<string, UnionArmConfig>();

  for (const arm of arms) {
    modernToArm.set(arm.modern, arm);
    if (arm.arm) {
      armNameToConfig.set(arm.arm, arm);
    }
    for (const sv of arm.switchValues) {
      switchToArm.set(sv, arm);
    }
  }

  class CompatUnion extends XdrTypeBase {
    static _codec = codec;

    private _switch: any;
    private _armName: string | undefined;
    private _armValue: any;

    constructor(switchVal: any, armName: string | undefined, armValue: any) {
      super();
      this._switch = switchVal;
      this._armName = armName;
      this._armValue = armValue;
    }

    switch(): any {
      return this._switch;
    }

    arm(): string | undefined {
      return this._armName;
    }

    value(): any {
      return this._armValue;
    }

    _toModern(): any {
      const switchKey: string | number = isIntDiscriminant
        ? this._switch
        : (typeof this._switch === 'string' ? this._switch : this._switch.name);
      const armConfig = switchToArm.get(switchKey);
      if (!armConfig) {
        throw new Error(`Unknown switch value: ${switchKey}`);
      }
      if (!armConfig.arm) {
        // Void arm — return string literal or number
        return armConfig.modern;
      }
      // Value arm — return { ModernKey: convertedValue }
      const modernValue = armConfig.convert
        ? armConfig.convert.toModern(this._armValue)
        : this._armValue;
      return { [armConfig.modern]: modernValue };
    }

    static _fromModern(modern: any): CompatUnion {
      if (typeof modern === 'string' || typeof modern === 'number') {
        // Void arm (string for enum, number for int discriminant)
        const armConfig = modernToArm.get(modern);
        if (!armConfig) {
          throw new Error(`Unknown modern union key: ${modern}`);
        }
        const sv = armConfig.switchValues[0]!;
        const switchVal = isIntDiscriminant ? sv : (switchEnum as any)[sv]();
        return new CompatUnion(switchVal, undefined, undefined);
      }
      // Value arm — { ModernKey: value }
      const modernKey = Object.keys(modern)[0]!;
      const modernValue = modern[modernKey];
      // Try string key first, then numeric
      let armConfig = modernToArm.get(modernKey);
      if (!armConfig) {
        const numKey = Number(modernKey);
        if (!isNaN(numKey)) armConfig = modernToArm.get(numKey);
      }
      if (!armConfig) {
        throw new Error(`Unknown modern union key: ${modernKey}`);
      }
      const sv = armConfig.switchValues[0]!;
      const switchVal = isIntDiscriminant ? sv : (switchEnum as any)[sv]();
      const compatValue = armConfig.convert
        ? armConfig.convert.toCompat(modernValue)
        : modernValue;
      return new CompatUnion(switchVal, armConfig.arm, compatValue);
    }
  }

  // Add static factory methods for each switch value
  for (const arm of arms) {
    for (const sv of arm.switchValues) {
      (CompatUnion as any)[sv] = (value?: any) => {
        const switchVal = isIntDiscriminant ? sv : (switchEnum as any)[sv]();
        if (!arm.arm) {
          return new CompatUnion(switchVal, undefined, undefined);
        }
        return new CompatUnion(switchVal, arm.arm, value);
      };
    }
  }

  // Add per-arm accessor methods
  for (const arm of arms) {
    if (arm.arm) {
      Object.defineProperty(CompatUnion.prototype, arm.arm, {
        value: function (this: CompatUnion, newVal?: any) {
          if (arguments.length > 0) {
            if ((this as any)._armName !== arm.arm) {
              throw new Error(`Cannot set ${arm.arm}: wrong arm (current: ${(this as any)._armName})`);
            }
            (this as any)._armValue = newVal;
            return undefined;
          }
          if ((this as any)._armName !== arm.arm) {
            throw new Error(`${arm.arm} is not set (current arm: ${(this as any)._armName})`);
          }
          return (this as any)._armValue;
        },
        writable: true,
        configurable: true,
      });
    }
  }

  return CompatUnion as any;
}
