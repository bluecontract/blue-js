import { generateKeyPairSync, sign } from 'node:crypto';

import { BexExecutionContext, BexProgramSource } from '@blue-labs/bex';
import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';

import {
  CoordinationBexIntrinsics,
  createCoordinationBexEngine,
} from './index.js';

describe('CoordinationBexIntrinsics', () => {
  it('verifies Ed25519 signatures through the common intrinsic', () => {
    const message = 'room:42:nonce:abc';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicKeyText = Buffer.from(
      publicKey.export({ format: 'der', type: 'spki' }),
    )
      .subarray(-32)
      .toString('base64url');
    const signature = sign(
      null,
      Buffer.from(message, 'utf8'),
      privateKey,
    ).toString('base64url');

    const result = createCoordinationBexEngine({
      intrinsics: CoordinationBexIntrinsics.common(),
    }).compileAndExecute(
      source({
        expr: {
          $intrinsic: {
            type: {
              blueId: 'Common/Crypto Ed25519 Verify',
            },
            publicKey: publicKeyText,
            message,
            signature,
          },
        },
      }),
      BexExecutionContext.builder().build(),
    );

    expect(result.value.toSimple()).toBe(true);
  });
});

function source(program: unknown): BexProgramSource {
  return BexProgramSource.inline(node(program));
}

function node(value: unknown): BlueNode {
  if (value === undefined) {
    return new BlueNode();
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return new BlueNode().setValue(value);
  }
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map(node));
  }
  const result = new BlueNode();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result.addProperty(key, node(child));
  }
  return result;
}
