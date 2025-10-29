import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { createBlue } from '../../test-support/blue.js';
import {
  IncrementPropertyContractProcessor,
  SetPropertyContractProcessor,
} from '../../__tests__/processors/index.js';
import {
  buildProcessor,
  expectOk,
  numericProperty,
  property,
  propertyOptional,
  typeBlueId,
} from '../../__tests__/test-utils.js';
import {
  TimelineEntrySchema,
  blueIds as conversationBlueIds,
} from '@blue-repository/conversation';
import type { ChannelEvaluationContext } from '../../registry/types.js';
import type { TimelineChannel } from '../../model/index.js';

const blue = createBlue();

function timelineEntryEvent(
  timelineId: string,
  overrides?: Partial<{
    kind: string;
    amount: number;
    timestamp: number;
    actorName: string;
  }>,
): BlueNode {
  const kind = overrides?.kind ?? 'set-price';
  const amount = overrides?.amount ?? 1500;
  const timestamp = overrides?.timestamp ?? 1_700_000_000;
  const actorName = overrides?.actorName ?? 'System';

  const yaml = `type: Timeline Entry
timeline:
  timelineId: ${timelineId}
message:
  type:
    blueId: SetPrice
  kind: ${kind}
  amount: ${amount}
actor:
  name: ${actorName}
timestamp: ${timestamp}
`;

  const entry = blue.yamlToNode(yaml);
  return entry;
}

async function initializeDocument() {
  const processor = buildProcessor(
    blue,
    new SetPropertyContractProcessor(),
    new IncrementPropertyContractProcessor(),
  );

  const documentYaml = `name: Timeline Test
contracts:
  timelineChannel:
    type: Timeline Channel
    timelineId: alice-timeline
  setPrice:
    channel: timelineChannel
    type:
      blueId: SetProperty
    propertyKey: /price
    propertyValue: 1500
  bumpCount:
    channel: timelineChannel
    type:
      blueId: IncrementProperty
    propertyKey: /count
`;

  const initializedResult = await expectOk(
    processor.initializeDocument(blue.yamlToNode(documentYaml)),
  );
  return { processor, initialized: initializedResult.document };
}

describe('TimelineChannelProcessor', () => {
  it('ignores non-timeline events and mismatched timeline ids', async () => {
    const { processor, initialized } = await initializeDocument();
    expect(
      processor
        .registry()
        .lookupChannel(conversationBlueIds['Timeline Channel']),
    ).toBeDefined();

    const randomEvent = blue.yamlToNode(`type:
  blueId: RandomEvent
`);
    const afterRandom = (
      await expectOk(
        processor.processDocument(initialized.clone(), randomEvent),
      )
    ).document;
    expect(propertyOptional(afterRandom, 'price')).toBeUndefined();
    expect(propertyOptional(afterRandom, 'count')).toBeUndefined();

    const mismatchedEntry = timelineEntryEvent('bob-timeline');
    const afterMismatched = (
      await expectOk(
        processor.processDocument(afterRandom.clone(), mismatchedEntry),
      )
    ).document;
    expect(propertyOptional(afterMismatched, 'price')).toBeUndefined();
    expect(propertyOptional(afterMismatched, 'count')).toBeUndefined();
  });

  it('delivers timeline entry messages to handlers and attaches metadata', async () => {
    const { processor, initialized } = await initializeDocument();
    expect(
      processor
        .registry()
        .lookupChannel(conversationBlueIds['Timeline Channel']),
    ).toBeDefined();

    const bundle = processor.contractLoader().load(initialized.clone(), '/');
    const timelineBinding = bundle.channelsOfType(
      conversationBlueIds['Timeline Channel'],
    )[0];
    expect(timelineBinding).toBeDefined();
    const bindingContract = timelineBinding.contract() as TimelineChannel;
    expect(bindingContract.timelineId).toBe('alice-timeline');

    const timelineProcessor = processor
      .registry()
      .lookupChannel(conversationBlueIds['Timeline Channel']);
    expect(timelineProcessor).toBeDefined();

    const matchingEntry = timelineEntryEvent('alice-timeline');
    const context: ChannelEvaluationContext = {
      scopePath: '/',
      blue,
      event: matchingEntry,
      markers: new Map(),
    };

    expect(blue.isTypeOf(matchingEntry, TimelineEntrySchema)).toBe(true);
    const doesMatch = await timelineProcessor!.matches(
      bindingContract,
      context,
    );
    expect(doesMatch).toBe(true);

    const afterMatching = (
      await expectOk(
        processor.processDocument(initialized.clone(), matchingEntry),
      )
    ).document;

    expect(numericProperty(afterMatching, 'price')).toBe(1500);
    expect(numericProperty(afterMatching, 'count')).toBe(1);

    const contracts = property(afterMatching, 'contracts');
    const checkpoint = property(contracts, 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedEvent = property(lastEvents, 'timelineChannel');

    // checkpoint stores the original external event (Timeline Entry)
    expect(typeBlueId(storedEvent)).toBe(conversationBlueIds['Timeline Entry']);

    const timeline = property(storedEvent, 'timeline');
    const timelineId = property(timeline, 'timelineId');
    expect(String(timelineId.getValue())).toBe('alice-timeline');

    const timestamp = property(storedEvent, 'timestamp');
    expect(Number(timestamp.getValue())).toBe(1_700_000_000);
  });

  it('skips duplicate timeline entries using the entry blue id', async () => {
    const { processor, initialized } = await initializeDocument();
    expect(
      processor
        .registry()
        .lookupChannel(conversationBlueIds['Timeline Channel']),
    ).toBeDefined();

    const firstEntry = timelineEntryEvent('alice-timeline');
    const afterFirstResult = await expectOk(
      processor.processDocument(initialized.clone(), firstEntry),
    );
    const afterFirst = afterFirstResult.document;
    expect(numericProperty(afterFirst, 'count')).toBe(1);

    const afterDuplicateResult = await expectOk(
      processor.processDocument(afterFirst.clone(), firstEntry),
    );
    const afterDuplicate = afterDuplicateResult.document;
    expect(numericProperty(afterDuplicate, 'count')).toBe(1);
  });
});
