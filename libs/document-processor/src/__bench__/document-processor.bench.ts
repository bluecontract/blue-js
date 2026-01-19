import { bench, describe } from 'vitest';
import type { BlueNode } from '@blue-labs/language';

import { DocumentProcessor } from '../api/document-processor.js';
import { createBlue } from '../test-support/blue.js';
import { fixtures } from './fixtures/index.js';

const blue = createBlue();
const processor = new DocumentProcessor({ blue });

type PreparedFixture = {
  name: string;
  document: BlueNode;
  events: ReadonlyArray<BlueNode>;
};

const preparedFixtures: PreparedFixture[] = fixtures.map((fixture) => ({
  name: fixture.name,
  document: blue.jsonValueToNode(fixture.document),
  events: fixture.events.map((event) => blue.jsonValueToNode(event)),
}));

async function runFixture(fixture: PreparedFixture): Promise<void> {
  const initResult = await processor.initializeDocument(
    fixture.document.clone(),
  );
  if (initResult.capabilityFailure) {
    throw new Error(
      `Benchmark fixture '${fixture.name}' failed to initialize: ${
        initResult.failureReason ?? 'capability failure'
      }`,
    );
  }

  let current = initResult.document;
  for (const event of fixture.events) {
    const result = await processor.processDocument(current, event);
    if (result.capabilityFailure) {
      throw new Error(
        `Benchmark fixture '${fixture.name}' failed to process event: ${
          result.failureReason ?? 'capability failure'
        }`,
      );
    }
    current = result.document;
  }
}

describe('document-processor benchmarks', () => {
  for (const fixture of preparedFixtures) {
    bench(fixture.name, async () => {
      await runFixture(fixture);
    });
  }
});
