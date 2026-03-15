import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toOfficialYaml } from '../../core/serialization.js';
import { allJavaSandboxSampleDocs } from '../java-sandbox-samples.js';

type Fixture = Record<string, string[]>;

function loadFixture(): Fixture {
  const fixturePath = fileURLToPath(
    new URL(
      '../../../../test-fixtures/java-sandbox-sample-intents.json',
      import.meta.url,
    ),
  );
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
}

describe('java sandbox sample intent fixtures', () => {
  it('matches fixture intent tokens for every non-IPFS sample', () => {
    const fixtures = loadFixture();
    const docs = allJavaSandboxSampleDocs();

    expect(Object.keys(docs).sort()).toEqual(Object.keys(fixtures).sort());

    for (const [sampleKey, expectedTokens] of Object.entries(fixtures)) {
      const yaml = toOfficialYaml(docs[sampleKey]);
      for (const expectedToken of expectedTokens) {
        expect(yaml).toContain(expectedToken);
      }
    }
  });
});
