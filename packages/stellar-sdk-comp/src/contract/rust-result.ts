/**
 * Rust-style Result types for contract return values.
 */

import type { ErrorMessage } from './types.js';

export interface Result<T, E extends ErrorMessage = ErrorMessage> {
  unwrap(): T;
  unwrapErr(): E;
  isOk(): boolean;
  isErr(): boolean;
}

export class Ok<T, E extends ErrorMessage = ErrorMessage> implements Result<T, E> {
  constructor(readonly value: T) {}
  unwrapErr(): E { throw new Error('No error'); }
  unwrap(): T { return this.value; }
  isOk(): boolean { return true; }
  isErr(): boolean { return false; }
}

export class Err<E extends ErrorMessage = ErrorMessage> implements Result<never, E> {
  constructor(readonly error: E) {}
  unwrapErr(): E { return this.error; }
  unwrap(): never { throw new Error(this.error.message); }
  isOk(): boolean { return false; }
  isErr(): boolean { return true; }
}
