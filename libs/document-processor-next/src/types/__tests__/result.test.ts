import {
  andThen,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  unwrapOr,
  unwrapOrElse,
} from '../result.js';

describe('Result helpers', () => {
  it('creates ok results', () => {
    const value = ok(42);

    expect(value).toEqual({ ok: true, value: 42 });
    expect(isOk(value)).toBe(true);
    expect(isErr(value)).toBe(false);
  });

  it('creates err results', () => {
    const value = err('nope');

    expect(value).toEqual({ ok: false, error: 'nope' });
    expect(isOk(value)).toBe(false);
    expect(isErr(value)).toBe(true);
  });

  it('maps ok results', () => {
    const value = map(ok(21), (n) => n * 2);
    expect(value).toEqual({ ok: true, value: 42 });
  });

  it('does not map err results', () => {
    const original = err('fail');
    const mapped = map(original, (n) => n);
    expect(mapped).toBe(original);
  });

  it('maps errors', () => {
    const mapped = mapErr(err('fail'), (reason) => ({ reason }));
    expect(mapped).toEqual({ ok: false, error: { reason: 'fail' } });
  });

  it('chains ok values', () => {
    const chained = andThen(ok(21), (n) => ok(n * 2));
    expect(chained).toEqual({ ok: true, value: 42 });
  });

  it('bails early on err', () => {
    const chained = andThen(err('fail'), () => ok(42));
    expect(chained).toEqual({ ok: false, error: 'fail' });
  });

  it('unwraps with fallbacks', () => {
    expect(unwrapOr(ok(42), 0)).toBe(42);
    expect(unwrapOr(err('fail'), 0)).toBe(0);
  });

  it('unwraps lazily', () => {
    const lazy = unwrapOrElse(err('fail'), (reason) => reason.length);
    expect(lazy).toBe(4);
  });

  it('matches results', () => {
    const okMatch = match(ok(42), {
      ok: (value) => value,
      err: () => 0,
    });
    const errMatch = match(err('fail'), {
      ok: () => 0,
      err: (reason) => reason.length,
    });

    expect(okMatch).toBe(42);
    expect(errMatch).toBe(4);
  });
});
