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
import { TimelineEntrySchema } from '@blue-repository/conversation';
import {
  MyOSTimelineEntrySchema,
  blueIds as myosBlueIds,
} from '@blue-repository/myos';
import type { ChannelEvaluationContext } from '../../registry/types.js';
import type { MyOSTimelineChannel } from '../../model/index.js';

const blue = createBlue();

function myosTimelineEntryEvent(
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

  const yaml = `type: MyOS Timeline Entry
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

  return blue.yamlToNode(yaml);
}

function conversationTimelineEntryEvent(
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

  return blue.yamlToNode(yaml);
}

async function initializeDocument() {
  const processor = buildProcessor(
    blue,
    new SetPropertyContractProcessor(),
    new IncrementPropertyContractProcessor(),
  );

  const documentYaml = `name: MyOS Timeline Test
contracts:
  myosTimelineChannel:
    type: MyOS Timeline Channel
    timelineId: alice-timeline
  setPrice:
    channel: myosTimelineChannel
    type:
      blueId: SetProperty
    propertyKey: /price
    propertyValue: 1500
  bumpCount:
    channel: myosTimelineChannel
    type:
      blueId: IncrementProperty
    propertyKey: /count
`;

  const initializedResult = await expectOk(
    processor.initializeDocument(blue.yamlToNode(documentYaml)),
  );

  return { processor, initialized: initializedResult.document };
}

describe('MyOSTimelineChannelProcessor', () => {
  it('processes MyOS timeline entry events when timeline ids align', async () => {
    const { processor, initialized } = await initializeDocument();
    expect(
      processor.registry().lookupChannel(myosBlueIds['MyOS Timeline Channel']),
    ).toBeDefined();

    const bundle = processor.contractLoader().load(initialized.clone(), '/');
    const channelBinding = bundle.channelsOfType(
      myosBlueIds['MyOS Timeline Channel'],
    )[0];
    expect(channelBinding).toBeDefined();

    const bindingContract = channelBinding.contract() as MyOSTimelineChannel;
    expect(bindingContract.timelineId).toBe('alice-timeline');

    const processorInstance = processor
      .registry()
      .lookupChannel(myosBlueIds['MyOS Timeline Channel']);
    expect(processorInstance).toBeDefined();

    const myosEntry = myosTimelineEntryEvent('alice-timeline');
    const context: ChannelEvaluationContext = {
      scopePath: '/',
      blue,
      event: myosEntry,
      markers: new Map(),
      bindingKey: channelBinding.key(),
    };

    expect(blue.isTypeOf(myosEntry, MyOSTimelineEntrySchema)).toBe(true);
    const doesMatch = await processorInstance!.matches(
      bindingContract,
      context,
    );
    expect(doesMatch).toBe(true);

    const afterProcessing = (
      await expectOk(processor.processDocument(initialized.clone(), myosEntry))
    ).document;

    expect(numericProperty(afterProcessing, 'price')).toBe(1500);
    expect(numericProperty(afterProcessing, 'count')).toBe(1);

    const contracts = property(afterProcessing, 'contracts');
    const checkpoint = property(contracts, 'checkpoint');
    const lastEvents = property(checkpoint, 'lastEvents');
    const storedEvent = property(lastEvents, 'myosTimelineChannel');
    expect(typeBlueId(storedEvent)).toBe(myosBlueIds['MyOS Timeline Entry']);
  });

  it('matches conversation timeline entries in addition to MyOS entries', async () => {
    const { processor, initialized } = await initializeDocument();
    const bundle = processor.contractLoader().load(initialized.clone(), '/');
    const channelBinding = bundle.channelsOfType(
      myosBlueIds['MyOS Timeline Channel'],
    )[0];
    const bindingContract = channelBinding.contract() as MyOSTimelineChannel;

    const processorInstance = processor
      .registry()
      .lookupChannel(myosBlueIds['MyOS Timeline Channel']);
    expect(processorInstance).toBeDefined();

    const conversationEntry = conversationTimelineEntryEvent('alice-timeline');
    const context: ChannelEvaluationContext = {
      scopePath: '/',
      blue,
      event: conversationEntry,
      markers: new Map(),
      bindingKey: channelBinding.key(),
    };

    expect(blue.isTypeOf(conversationEntry, TimelineEntrySchema)).toBe(true);
    const doesMatch = await processorInstance!.matches(
      bindingContract,
      context,
    );
    expect(doesMatch).toBe(true);

    const afterProcessing = (
      await expectOk(
        processor.processDocument(initialized.clone(), conversationEntry),
      )
    ).document;

    expect(numericProperty(afterProcessing, 'price')).toBe(1500);
    expect(numericProperty(afterProcessing, 'count')).toBe(1);
  });

  it('ignores events that are not timeline entries or have mismatched ids', async () => {
    const { processor, initialized } = await initializeDocument();

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

    const mismatchedEntry = myosTimelineEntryEvent('bob-timeline');
    const afterMismatched = (
      await expectOk(
        processor.processDocument(afterRandom.clone(), mismatchedEntry),
      )
    ).document;
    expect(propertyOptional(afterMismatched, 'price')).toBeUndefined();
    expect(propertyOptional(afterMismatched, 'count')).toBeUndefined();

    const conversationMismatched =
      conversationTimelineEntryEvent('charlie-timeline');
    const afterConversation = (
      await expectOk(
        processor.processDocument(
          afterMismatched.clone(),
          conversationMismatched,
        ),
      )
    ).document;
    expect(propertyOptional(afterConversation, 'price')).toBeUndefined();
    expect(propertyOptional(afterConversation, 'count')).toBeUndefined();
  });
});
