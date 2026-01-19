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

async function runFixtureBackendStyle(fixture: PreparedFixture): Promise<void> {
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
    const resolvedEvent = blue.resolve(event);
    const result = await processor.processDocument(current, resolvedEvent);
    if (result.capabilityFailure) {
      throw new Error(
        `Benchmark fixture '${fixture.name}' failed to process event: ${
          result.failureReason ?? 'capability failure'
        }`,
      );
    }

    current = result.document;

    await blue.calculateBlueId(current);
    blue.nodeToJson(current);
    blue.nodeToJson(event);

    if (result.triggeredEvents.length > 0) {
      for (const emitted of result.triggeredEvents) {
        blue.nodeToJson(emitted);
      }
      const emittedTypes: string[] = [];
      for (const emitted of result.triggeredEvents) {
        const type = emitted.getType()?.getBlueId();
        if (type && !emittedTypes.includes(type)) {
          emittedTypes.push(type);
        }
      }
    }
  }
}

describe('document-processor backend-style benchmarks', () => {
  for (const fixture of preparedFixtures) {
    bench(`${fixture.name}-backend-style`, async () => {
      await runFixtureBackendStyle(fixture);
    });
  }
});
