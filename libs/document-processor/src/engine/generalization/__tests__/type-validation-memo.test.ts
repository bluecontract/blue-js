import { describe, expect, it } from 'vitest';

import { TypeValidationMemo } from '../type-validation-memo.js';

describe('TypeValidationMemo', () => {
  it('caches matcher booleans by pointer and expected type', () => {
    const memo = new TypeValidationMemo();

    memo.set('/amount', 'PayNoteAmountType', true);

    expect(memo.get('/amount', 'PayNoteAmountType')).toBe(true);
    expect(memo.get('/amount', 'OtherType')).toBeUndefined();
    expect(memo.get('/amount/value', 'PayNoteAmountType')).toBeUndefined();
  });

  it('clears all cached validation answers explicitly', () => {
    const memo = new TypeValidationMemo();

    memo.set('/x', 'T', true);
    expect(memo.get('/x', 'T')).toBe(true);

    memo.clear();

    expect(memo.get('/x', 'T')).toBeUndefined();
    expect(memo.size()).toBe(0);
  });

  it('can be disabled with maxEntries 0', () => {
    const memo = new TypeValidationMemo({ maxEntries: 0 });

    memo.set('/amount', 'PayNoteAmountType', true);

    expect(memo.get('/amount', 'PayNoteAmountType')).toBeUndefined();
    expect(memo.size()).toBe(0);
  });

  it('invalidates changed paths, ancestors, and descendants segment-wise', () => {
    const memo = new TypeValidationMemo();
    memo.set('/order', 'OrderType', true);
    memo.set('/order/items/0', 'OrderItemType', true);
    memo.set('/order/items/0/amount', 'AmountType', true);
    memo.set('/order/items-extra', 'OtherType', true);
    memo.set('/order', 'GeneratedTypeWriteType', true);

    memo.invalidateForMutation('/order/items/0');

    expect(memo.get('/order', 'OrderType')).toBeUndefined();
    expect(memo.get('/order/items/0', 'OrderItemType')).toBeUndefined();
    expect(memo.get('/order/items/0/amount', 'AmountType')).toBeUndefined();
    expect(memo.get('/order/items-extra', 'OtherType')).toBe(true);
    expect(memo.get('/order', 'GeneratedTypeWriteType')).toBeUndefined();
  });

  it('invalidates generated type writes against the owning node', () => {
    const memo = new TypeValidationMemo();
    memo.set('/order', 'OrderType', true);
    memo.set('/order/type', 'TypeDescriptor', true);
    memo.set('/order/items', 'OrderItems', true);

    memo.invalidateForMutation('/order/type');

    expect(memo.get('/order', 'OrderType')).toBeUndefined();
    expect(memo.get('/order/type', 'TypeDescriptor')).toBeUndefined();
    expect(memo.get('/order/items', 'OrderItems')).toBe(true);
  });
});
