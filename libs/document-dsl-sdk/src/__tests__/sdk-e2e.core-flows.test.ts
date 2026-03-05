import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';
import { EventSchema } from '@blue-repository/types/packages/conversation/schemas/Event';
import { SubscribeToSessionRequestedSchema } from '@blue-repository/types/packages/myos/schemas/SubscribeToSessionRequested';
import { DocBuilder } from '../builders/doc-builder.js';
import { expr } from '../expr.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
  makeTimelineEntryYaml,
} from '../test-support/runtime.js';

describe('sdk e2e: core document processor flows', () => {
  const isEventTypePresent = (
    blue: ReturnType<typeof getBlue>,
    events: readonly BlueNode[],
    schema: unknown,
    predicate?: (event: BlueNode) => boolean,
  ): boolean =>
    events.some((event) => {
      const message = event.get('/message');
      const candidates = [
        event,
        ...(message instanceof BlueNode ? [message] : []),
      ];
      return candidates.some(
        (candidate) =>
          blue.isTypeOf(candidate, schema as never) &&
          (predicate ? predicate(candidate) : true),
      );
    });

  it('runs operation workflow for timeline operation request', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Counter document')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-session',
      })
      .operation('increment')
      .channel('ownerChannel')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyIncrement',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    const event = blue.yamlToNode(
      makeTimelineEntryYaml(
        'owner-session',
        `type: Conversation/Operation Request
operation: increment
request: 5`,
      ),
    );
    const processed = await expectOk(
      processor.processDocument(initialized.document.clone(), event),
    );

    expect(Number(processed.document.get('/counter'))).toBe(5);
  });

  it('initializes direct-change contracts without capability failures', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Direct change document')
      .field('/status', 'draft')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-session',
      })
      .contractsPolicy({ requireSectionChanges: false })
      .directChange('changeByOwner', 'ownerChannel')
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );
    expect(String(initialized.document.get('/status'))).toBe('draft');
    expect(processor.isInitialized(initialized.document)).toBe(true);
  });

  it('handles init + doc-change + myos subscription trigger events', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Lifecycle document')
      .field('/targetSessionId', 'catalog-session')
      .field('/status', 'draft')
      .onInit('initWorkflow', (steps) =>
        steps
          .replaceValue('SetReady', '/status', 'ready')
          .myOs()
          .subscribeToSession(
            'ownerChannel',
            expr("document('/targetSessionId')"),
            'SUB_CATALOG',
            [{ type: 'MyOS/Call Operation Responded' }],
          ),
      )
      .onDocChange('statusWatcher', '/status', (steps) =>
        steps.namedEvent('EmitStatusChanged', 'STATUS_CHANGED'),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(String(initialized.document.get('/status'))).toBe('ready');
    expect(
      isEventTypePresent(
        blue,
        initialized.triggeredEvents as BlueNode[],
        SubscribeToSessionRequestedSchema,
      ),
    ).toBe(true);
    expect(
      isEventTypePresent(
        blue,
        initialized.triggeredEvents as BlueNode[],
        EventSchema,
        (event) => String(event.get('/name')) === 'STATUS_CHANGED',
      ),
    ).toBe(true);
  });
});
