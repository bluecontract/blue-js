import { createBlue } from '../../test-support/blue.js';
import { BlueNode } from '@blue-labs/language';
import { Buffer } from 'node:buffer';
import canonicalize from 'canonicalize';

import { canonicalSize } from '../node-canonicalizer.js';

const blue = createBlue();

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

function canonicalPayload(node: BlueNode): string {
  return canonicalize(blue.nodeToJson(node, 'official'));
}

describe('node-canonicalizer', () => {
  it('returns zero size for null node', () => {
    expect(canonicalSize(blue, undefined)).toBe(0);
  });

  it('produces identical sizes regardless of insertion order', () => {
    const nodeA = createSampleNode('normal');
    const nodeB = createSampleNode('reverse');

    expect(canonicalPayload(nodeA)).toEqual(canonicalPayload(nodeB));
    expect(canonicalSize(blue, nodeA)).toEqual(canonicalSize(blue, nodeB));
  });

  it('computes canonical size based on utf8 byte length', () => {
    const node = createSampleNode();
    expect(canonicalSize(blue, node)).toEqual(
      Buffer.byteLength(canonicalPayload(node), 'utf8'),
    );
  });

  it('emits keys in lexicographic order', () => {
    const node = blue.jsonValueToNode({
      zeta: 'last',
      alpha: 'first',
      middle: 'mid',
    });

    const payload = canonicalPayload(node);
    const alphaIndex = payload.indexOf('"alpha"');
    const middleIndex = payload.indexOf('"middle"');
    const zetaIndex = payload.indexOf('"zeta"');
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(middleIndex).toBeGreaterThan(alphaIndex);
    expect(zetaIndex).toBeGreaterThan(middleIndex);
  });
});
