import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  property,
  typeBlueId,
} from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

const blue = createBlue();

describe('TriggerEventStepExecutor (integration)', () => {
  it('emits events during initialization workflows', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: Trigger Event Workflow
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitWelcome
        type: Trigger Event
        event:
          type: Chat Message
          message: Welcome!`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;
    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('Welcome!');
  });

  it('delivers Trigger Event payloads to Triggered Event Channel consumers', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: Trigger Event produces and consumes triggered events
contracts:
  life:
    type: Lifecycle Event Channel
  trig:
    type: Triggered Event Channel
  producer:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitCompleted
        type: Trigger Event
        event:
          type: Status Completed
  consumer:
    type: Sequential Workflow
    channel: trig
    event:
      type: Status Completed
    steps:
      - name: EmitChat
        type: Trigger Event
        event:
          type: Chat Message
          message: Triggered via Triggered Event Channel`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;

    const completedEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Status Completed'],
    );
    expect(completedEvents.length).toBe(1);

    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('Triggered via Triggered Event Channel');
  });

  it('resolves expressions within Trigger Event payloads', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: Trigger Event resolves expressions
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: PreparePayment
        type: JavaScript Code
        code: |
          return {
            amount: 125,
            description: 'Subscription renewal'
          };
      - name: EmitPayment
        type: Trigger Event
        event:
          type: Chat Message
          message: \${steps.PreparePayment.description} for \${steps.PreparePayment.amount} USD`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;
    const paymentEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(paymentEvents.length).toBe(1);
    const message = property(paymentEvents[0], 'message').getValue();
    expect(message).toBe('Subscription renewal for 125 USD');
  });
});
