import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';

import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import {
  ContractProcessor,
  ContractRole,
  DocumentNode,
  ProcessingContext,
  EventNode,
} from '../types';
import { ProcessorFatalError } from '../utils/exceptions';
import { createTimelineEntryEvent } from '../utils/eventFactories';

describe('BlueDocumentProcessor preflight validation', () => {
  const blue = new Blue({ repositories: [coreRepository] });

  it('returns capability failure for unsupported contract types', async () => {
    const processor = new BlueDocumentProcessor(blue);
    const doc = blue.jsonValueToNode({
      contracts: {
        unknown: {
          type: { blueId: 'test/unsupported-contract' },
        },
      },
    });

    const result = await processor.initialize(doc);

    expect(result.capabilityFailure).toBe(true);
    expect(result.emitted).toHaveLength(0);

    const originalJson = blue.nodeToJson(doc, 'simple');
    const resultJson = blue.nodeToJson(result.state, 'simple');
    expect(resultJson).toEqual(originalJson);
  });

  it('raises a fatal error when reserved checkpoint key has an incompatible type', async () => {
    const processor = new BlueDocumentProcessor(blue);
    const doc = blue.jsonValueToNode({
      contracts: {
        checkpoint: {
          type: 'Timeline Channel',
        },
      },
    });

    await expect(processor.initialize(doc)).rejects.toBeInstanceOf(
      ProcessorFatalError
    );
  });

  it('delivers cloned and frozen payloads to processors', async () => {
    const customBlueId = 'test/contracts/frozen-event';
    const observed: {
      payload?: DocumentNode;
      isFrozen?: boolean;
      mutationError?: unknown;
      receivedEvent?: EventNode;
    } = {};

    class TestProcessor implements ContractProcessor {
      readonly contractType = 'Frozen Event Contract';
      readonly contractBlueId = customBlueId;
      readonly role: ContractRole = 'handler';

      supports(event: EventNode): boolean {
        return event.source === 'external';
      }

      handle(
        event: EventNode,
        _contractNode: DocumentNode,
        ctx: ProcessingContext
      ): void {
        observed.payload = event.payload as DocumentNode;
        observed.isFrozen = Object.isFrozen(event.payload);
        observed.receivedEvent = event;
        try {
          (event.payload as DocumentNode).addProperty(
            'mutated',
            ctx.getBlue().jsonValueToNode({ value: 1 })
          );
        } catch (error) {
          observed.mutationError = error;
        }
      }
    }

    const processor = new BlueDocumentProcessor(blue);
    processor.register(new TestProcessor());
    const docNode = blue.jsonValueToNode({
      contracts: {
        test: {
          type: {
            blueId: customBlueId,
          },
        },
      },
    });

    const initResult = await processor.initialize(docNode);
    expect(initResult.capabilityFailure).toBe(false);
    const initializedState = initResult.state;

    const payload = createTimelineEntryEvent('frozen-events', null, blue);

    const result = await processor.processEvents(initializedState, [payload]);

    expect(result.capabilityFailure).toBe(false);
    expect(observed.payload).toBeDefined();
    expect(observed.payload).not.toBe(payload);
    expect(observed.isFrozen).toBe(true);
    expect(observed.mutationError).toBeInstanceOf(TypeError);
    expect(observed.receivedEvent?.payload).toBe(observed.payload);
  });
});
