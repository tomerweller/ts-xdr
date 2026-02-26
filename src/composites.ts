import { BaseCodec, type XdrCodec } from './codec.js';
import { XdrError, XdrErrorCode } from './errors.js';
import { XdrReader } from './reader.js';
import { XdrWriter } from './writer.js';

// ---- xdrStruct ----

export function xdrStruct<T>(
  fields: ReadonlyArray<readonly [string, XdrCodec<any>]>,
): XdrCodec<T> {
  return new (class extends BaseCodec<T> {
    encode(writer: XdrWriter, value: T): void {
      writer.limits.withDepth(() => {
        for (const [name, codec] of fields) {
          codec.encode(writer, (value as any)[name]);
        }
      });
    }
    decode(reader: XdrReader): T {
      return reader.limits.withDepth(() => {
        const result: Record<string, unknown> = {};
        for (const [name, codec] of fields) {
          result[name] = codec.decode(reader);
        }
        return result as T;
      });
    }
    toJsonValue(value: T): unknown {
      const result: Record<string, unknown> = {};
      for (const [name, codec] of fields) {
        result[name] = codec.toJsonValue((value as any)[name]);
      }
      return result;
    }
    fromJsonValue(json: unknown): T {
      const obj = json as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [name, codec] of fields) {
        result[name] = codec.fromJsonValue(obj[name]);
      }
      return result as T;
    }
  })();
}

// ---- xdrEnum ----

export function xdrEnum<D extends Record<string, number>>(
  members: D,
): XdrCodec<keyof D & string> & Readonly<D> {
  const reverseMap = new Map<number, string>();
  for (const [name, value] of Object.entries(members)) {
    reverseMap.set(value, name);
  }

  const codec = new (class extends BaseCodec<keyof D & string> {
    encode(writer: XdrWriter, value: keyof D & string): void {
      const numericValue = members[value];
      if (numericValue === undefined) {
        throw new XdrError(
          XdrErrorCode.InvalidEnumValue,
          `Unknown enum member: ${String(value)}`,
        );
      }
      writer.writeInt32(numericValue);
    }
    decode(reader: XdrReader): keyof D & string {
      const raw = reader.readInt32();
      const name = reverseMap.get(raw);
      if (name === undefined) {
        throw new XdrError(
          XdrErrorCode.InvalidEnumValue,
          `Unknown enum value: ${raw}`,
        );
      }
      return name as keyof D & string;
    }
  })();

  // Copy enum member properties onto the codec object
  return Object.assign(codec, members) as XdrCodec<keyof D & string> &
    Readonly<D>;
}

// ---- lazy ----

export function lazy<T>(factory: () => XdrCodec<T>): XdrCodec<T> {
  let cached: XdrCodec<T> | undefined;
  const get = () => (cached ??= factory());
  return new (class extends BaseCodec<T> {
    encode(writer: XdrWriter, value: T): void {
      get().encode(writer, value);
    }
    decode(reader: XdrReader): T {
      return get().decode(reader);
    }
    toJsonValue(value: T): unknown {
      return get().toJsonValue(value);
    }
    fromJsonValue(json: unknown): T {
      return get().fromJsonValue(json);
    }
  })();
}

// ---- is ----

export function is<K extends string>(
  union: string | Record<string, unknown>,
  key: K,
): union is Record<K, any> {
  return typeof union === 'object' && union !== null && key in union;
}

// ---- taggedUnion ----

interface UnionArm {
  tags: readonly (string | number)[];
  key?: string;
  codec?: XdrCodec<any>;
}

interface TaggedUnionConfig {
  switchOn: XdrCodec<any>;
  arms: ReadonlyArray<UnionArm>;
  defaultArm?: { codec?: XdrCodec<any> };
}

export function taggedUnion(config: TaggedUnionConfig): XdrCodec<any> {
  // Forward map: tag → { key, codec }
  const forwardMap = new Map<
    string | number,
    { key: string; codec?: XdrCodec<any> }
  >();
  // Reverse map: key → { tag, codec }
  const reverseMap = new Map<
    string,
    { tag: string | number; codec?: XdrCodec<any> }
  >();

  for (const arm of config.arms) {
    for (const tag of arm.tags) {
      const key =
        arm.key !== undefined
          ? arm.key
          : typeof tag === 'string'
            ? tag
            : String(tag);
      forwardMap.set(tag, { key, codec: arm.codec });
      // Only map the first tag per key for reverse (all tags in same arm share key)
      if (!reverseMap.has(key)) {
        reverseMap.set(key, { tag, codec: arm.codec });
      }
    }
  }

  return new (class extends BaseCodec<any> {
    encode(writer: XdrWriter, value: any): void {
      writer.limits.withDepth(() => {
        if (typeof value === 'string') {
          // Void arm: value is the key string
          const entry = reverseMap.get(value);
          if (entry !== undefined) {
            config.switchOn.encode(writer, entry.tag);
          } else if (config.defaultArm !== undefined) {
            // Default void arm: try to parse key back to tag
            const tag = this._parseTag(value);
            config.switchOn.encode(writer, tag);
          } else {
            throw new XdrError(
              XdrErrorCode.InvalidUnionDiscriminant,
              `Unknown union key: ${value}`,
            );
          }
        } else {
          // Non-void arm: value is { [key]: armValue }
          const key = Object.keys(value)[0]!;
          const armValue = value[key];
          const entry = reverseMap.get(key);
          if (entry !== undefined) {
            config.switchOn.encode(writer, entry.tag);
            if (entry.codec !== undefined) {
              entry.codec.encode(writer, armValue);
            }
          } else if (config.defaultArm !== undefined) {
            // Default arm
            const tag = this._parseTag(key);
            config.switchOn.encode(writer, tag);
            if (config.defaultArm.codec !== undefined) {
              config.defaultArm.codec.encode(writer, armValue);
            }
          } else {
            throw new XdrError(
              XdrErrorCode.InvalidUnionDiscriminant,
              `Unknown union key: ${key}`,
            );
          }
        }
      });
    }

    decode(reader: XdrReader): any {
      return reader.limits.withDepth(() => {
        const tag = config.switchOn.decode(reader);
        const entry = forwardMap.get(tag);

        if (entry !== undefined) {
          if (entry.codec !== undefined) {
            return { [entry.key]: entry.codec.decode(reader) };
          }
          return entry.key;
        }

        // Not in explicit arms, try default
        if (config.defaultArm === undefined) {
          throw new XdrError(
            XdrErrorCode.InvalidUnionDiscriminant,
            `Unknown union discriminant: ${String(tag)}`,
          );
        }

        const key = typeof tag === 'number' ? String(tag) : tag;
        if (config.defaultArm.codec !== undefined) {
          return { [key]: config.defaultArm.codec.decode(reader) };
        }
        return key;
      });
    }

    toJsonValue(value: any): unknown {
      if (typeof value === 'string') {
        return value;
      }
      const key = Object.keys(value)[0]!;
      const armValue = value[key];
      const entry = reverseMap.get(key);
      const codec = entry?.codec ?? config.defaultArm?.codec;
      if (codec !== undefined) {
        return { [key]: codec.toJsonValue(armValue) };
      }
      return value;
    }

    fromJsonValue(json: unknown): any {
      if (typeof json === 'string') {
        return json;
      }
      const obj = json as Record<string, unknown>;
      const key = Object.keys(obj)[0]!;
      const jsonValue = obj[key];
      const entry = reverseMap.get(key);
      const codec = entry?.codec ?? config.defaultArm?.codec;
      if (codec !== undefined) {
        return { [key]: codec.fromJsonValue(jsonValue) };
      }
      return json;
    }

    _parseTag(key: string): string | number {
      const asNum = parseInt(key, 10);
      if (!isNaN(asNum) && String(asNum) === key) {
        return asNum;
      }
      return key;
    }
  })();
}
