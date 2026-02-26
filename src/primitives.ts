import { BaseCodec, type XdrCodec } from './codec.js';
import { XdrReader } from './reader.js';
import { XdrWriter } from './writer.js';

class Int32Codec extends BaseCodec<number> {
  encode(writer: XdrWriter, value: number): void {
    writer.writeInt32(value);
  }
  decode(reader: XdrReader): number {
    return reader.readInt32();
  }
}

class Uint32Codec extends BaseCodec<number> {
  encode(writer: XdrWriter, value: number): void {
    writer.writeUint32(value);
  }
  decode(reader: XdrReader): number {
    return reader.readUint32();
  }
}

class Int64Codec extends BaseCodec<bigint> {
  encode(writer: XdrWriter, value: bigint): void {
    writer.writeInt64(value);
  }
  decode(reader: XdrReader): bigint {
    return reader.readInt64();
  }
  toJsonValue(value: bigint): unknown {
    return String(value);
  }
  fromJsonValue(json: unknown): bigint {
    return BigInt(json as string);
  }
}

class Uint64Codec extends BaseCodec<bigint> {
  encode(writer: XdrWriter, value: bigint): void {
    writer.writeUint64(value);
  }
  decode(reader: XdrReader): bigint {
    return reader.readUint64();
  }
  toJsonValue(value: bigint): unknown {
    return String(value);
  }
  fromJsonValue(json: unknown): bigint {
    return BigInt(json as string);
  }
}

class Float32Codec extends BaseCodec<number> {
  encode(writer: XdrWriter, value: number): void {
    writer.writeFloat32(value);
  }
  decode(reader: XdrReader): number {
    return reader.readFloat32();
  }
}

class Float64Codec extends BaseCodec<number> {
  encode(writer: XdrWriter, value: number): void {
    writer.writeFloat64(value);
  }
  decode(reader: XdrReader): number {
    return reader.readFloat64();
  }
}

class BoolCodec extends BaseCodec<boolean> {
  encode(writer: XdrWriter, value: boolean): void {
    writer.writeBool(value);
  }
  decode(reader: XdrReader): boolean {
    return reader.readBool();
  }
}

class VoidCodec extends BaseCodec<void> {
  encode(_writer: XdrWriter, _value: void): void {
    // void encodes nothing
  }
  decode(_reader: XdrReader): void {
    // void decodes nothing
  }
  toJsonValue(_value: void): unknown {
    return null;
  }
  fromJsonValue(_json: unknown): void {
    // void
  }
}

export const int32: XdrCodec<number> = new Int32Codec();
export const uint32: XdrCodec<number> = new Uint32Codec();
export const int64: XdrCodec<bigint> = new Int64Codec();
export const uint64: XdrCodec<bigint> = new Uint64Codec();
export const float32: XdrCodec<number> = new Float32Codec();
export const float64: XdrCodec<number> = new Float64Codec();
export const bool: XdrCodec<boolean> = new BoolCodec();
export const xdrVoid: XdrCodec<void> = new VoidCodec();
