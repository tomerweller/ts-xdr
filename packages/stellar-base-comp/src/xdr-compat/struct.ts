/**
 * createCompatStruct — factory for compat struct classes.
 *
 * Creates a class with:
 * - Constructor: new Type({ field1: val1, ... })
 * - Per-field getter/setter: instance.field() / instance.field(newVal)
 * - _toModern() / static _fromModern(v) for conversion
 * - Inherited toXDR/fromXDR/validateXDR from XdrTypeBase
 */

import type { XdrCodec } from '@stellar/xdr';
import { XdrTypeBase } from './base.js';
import type { Converter } from './converters.js';

export interface StructFieldConfig {
  name: string;
  modernName?: string;
  convert: Converter<any, any>;
}

export interface CompatStructConfig {
  codec: XdrCodec<any>;
  fields: StructFieldConfig[];
}

export interface CompatStructClass {
  new (attrs: Record<string, any>): any;
  _codec: XdrCodec<any>;
  _fromModern(modern: any): any;
  fromXDR(input: Uint8Array | string, format?: string): any;
  validateXDR(input: Uint8Array | string, format?: string): boolean;
}

export function createCompatStruct(config: CompatStructConfig): CompatStructClass {
  const { codec, fields } = config;

  class CompatStruct extends XdrTypeBase {
    static _codec = codec;
    _attributes: Record<string, any>;

    constructor(attrs: Record<string, any>) {
      super();
      this._attributes = {};
      for (const field of fields) {
        if (field.name in attrs) {
          this._attributes[field.name] = attrs[field.name];
        }
      }
    }

    _toModern(): any {
      const result: Record<string, any> = {};
      for (const field of fields) {
        const mName = field.modernName ?? field.name;
        result[mName] = field.convert.toModern(this._attributes[field.name]);
      }
      return result;
    }

    static _fromModern(modern: any): any {
      const attrs: Record<string, any> = {};
      for (const field of fields) {
        const mName = field.modernName ?? field.name;
        attrs[field.name] = field.convert.toCompat(modern[mName]);
      }
      return new CompatStruct(attrs);
    }
  }

  // Add per-field getter/setter methods
  for (const field of fields) {
    Object.defineProperty(CompatStruct.prototype, field.name, {
      value: function (this: any, newVal?: any) {
        if (arguments.length === 0) {
          return this._attributes[field.name];
        }
        this._attributes[field.name] = newVal;
        return undefined;
      },
      writable: true,
      configurable: true,
    });
  }

  return CompatStruct as any;
}
