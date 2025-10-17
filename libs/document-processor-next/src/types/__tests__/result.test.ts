// @blue-labs/document-processor/test/types/result.spec.ts
import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  match,
  map,
  mapErr,
  andThen,
  unsafeUnwrap,
  unsafeUnwrapErr,
} from '../result.js';

describe('Result', () => {
  it('constructs and narrows', () => {
    const r1 = ok(2);
    const r2 = err('boom');
    expect(isOk(r1)).toBe(true);
    expect(isErr(r2)).toBe(true);
    if (isOk(r1)) {
      const v = r1.val;
      expect(v).toBe(2);
    }
    if (isErr(r2)) {
      const e = r2.err;
      expect(e).toBe('boom');
    }
  });

  it('maps and matches', () => {
    const r = map(ok(2), (n) => n * 3);
    expect(unsafeUnwrap(r)).toBe(6);

    const out = match(err('x'), {
      ok: () => 'ok',
      err: (e) => e + '!',
    });
    expect(out).toBe('x!');
  });

  it('mapErr and andThen', () => {
    const r = andThen(ok(2), (n) => (n > 1 ? ok(n + 1) : err('nope')));
    expect(unsafeUnwrap(r)).toBe(3);

    const e = mapErr(err({ code: 400 }), (x) => ({
      ...x,
      tag: 'Bad' as const,
    }));
    expect(unsafeUnwrapErr(e)).toMatchObject({ code: 400, tag: 'Bad' });
  });
});
