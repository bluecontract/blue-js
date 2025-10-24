import { Blue, BlueNode } from '@blue-labs/language';
import { Buffer } from 'node:buffer';

import { canonicalSignature, canonicalSize } from '../node-canonicalizer.js';

const blue = new Blue();

function createSampleNode(order: 'normal' | 'reverse' = 'normal'): BlueNode {
  if (order === 'normal') {
    return blue.jsonValueToNode({
      payload: {
        count: 3,
        enabled: true,
        items: ['alpha', 'beta'],
      },
      meta: { label: 'Test' },
    });
  }
  return blue.jsonValueToNode({
    meta: { label: 'Test' },
    payload: {
      items: ['alpha', 'beta'],
      enabled: true,
      count: 3,
    },
  });
}

describe('node-canonicalizer', () => {
  it('returns null signature for null node', () => {
    expect(canonicalSignature(null)).toBeNull();
  });

  it('returns zero size for null node', () => {
    expect(canonicalSize(undefined)).toBe(0);
  });

  it('produces identical signatures regardless of insertion order', () => {
    const signatureA = canonicalSignature(createSampleNode('normal'));
    const signatureB = canonicalSignature(createSampleNode('reverse'));

    expect(signatureA).not.toBeNull();
    expect(signatureA).toEqual(signatureB);
  });

  it('computes canonical size based on utf8 byte length', () => {
    const node = createSampleNode();
    const signature = canonicalSignature(node);
    expect(signature).not.toBeNull();
    expect(canonicalSize(node)).toEqual(
      Buffer.byteLength(signature ?? '', 'utf8')
    );
  });

  it('emits keys in lexicographic order', () => {
    const node = blue.jsonValueToNode({
      zeta: 'last',
      alpha: 'first',
      middle: 'mid',
    });

    const signature = canonicalSignature(node);
    expect(signature).not.toBeNull();
    const alphaIndex = signature!.indexOf('"alpha"');
    const middleIndex = signature!.indexOf('"middle"');
    const zetaIndex = signature!.indexOf('"zeta"');
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(middleIndex).toBeGreaterThan(alphaIndex);
    expect(zetaIndex).toBeGreaterThan(middleIndex);
  });
});
