/**
 * Minimal, ergonomic Result type inspired by Rust/FP libraries.
 * Use at all public boundaries; never throw for expected error paths.
 */

export type Ok<T> = {
  readonly ok: true;
  readonly val: T;
};

export type Err<E = unknown> = {
  readonly ok: false;
  readonly err: E;
};

export type Result<T, E = unknown> = Ok<T> | Err<E>;

/** Constructors */
export const ok = <T>(val: T): Ok<T> => ({ ok: true as const, val });
export const err = <E = unknown>(error: E): Err<E> => ({
  ok: false as const,
  err: error,
});

/** Type guards */
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/** Unwrap helpers (safe) */
export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T =>
  r.ok ? r.val : fallback;
export const unwrapOrElse = <T, E>(r: Result<T, E>, f: (e: E) => T): T =>
  r.ok ? r.val : f(r.err);

/** Transformations */
export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.val)) : r;

export const mapErr = <T, E, F>(
  r: Result<T, E>,
  f: (e: E) => F
): Result<T, F> => (r.ok ? r : err(f(r.err)));

export const andThen = <T, U, E>(
  r: Result<T, E>,
  f: (t: T) => Result<U, E>
): Result<U, E> => (r.ok ? f(r.val) : r);

export const match = <T, E, U>(
  r: Result<T, E>,
  handlers: { ok: (t: T) => U; err: (e: E) => U }
): U => (r.ok ? handlers.ok(r.val) : handlers.err(r.err));

/** Dangerous unwraps (use in tests, not prod code paths) */
export const unsafeUnwrap = <T, E>(r: Result<T, E>): T => {
  if (!r.ok) throw new Error(`unsafeUnwrap called on Err: ${String(r.err)}`);
  return r.val;
};
export const unsafeUnwrapErr = <T, E>(r: Result<T, E>): E => {
  if (r.ok) throw new Error(`unsafeUnwrapErr called on Ok: ${String(r.val)}`);
  return r.err;
};

/** Exhaustiveness helper */
export const assertNever = (x: never): never => {
  throw { message: 'Unreachable', value: x };
};
