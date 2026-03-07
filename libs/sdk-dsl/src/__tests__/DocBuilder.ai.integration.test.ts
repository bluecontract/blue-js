/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderAiDslParityTest.java
*/

import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const ADMIN_TIMELINE_ID = 'stage5-admin-timeline';
const OWNER_TIMELINE_ID = 'stage5-owner-timeline';
const PROVIDER_SESSION_ID = 'provider-session-1';

describe('DocBuilder AI integration', () => {
  function buildAiCaller(options?: { readonly manual?: boolean }) {
    const ai = DocBuilder.doc()
      .name('AI caller integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .field('/prompt', 'Provide structured output')
      .field('/status', 'idle')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER');

    const aiConfigured = options?.manual
      ? ai.requestPermissionManually().done()
      : ai.done();

    return aiConfigured
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();
  }

  it('emits a permission request during init-driven AI setup', async () => {
    const initialized = await initializeDocument(buildAiCaller());

    expect(String(initialized.document.get('/mealAI/status'))).toBe('pending');

    const permissionRequest = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
          myOsBlueIds['MyOS/Single Document Permission Grant Requested'] &&
        event.getProperties()?.requestId?.getValue() === 'REQ_MEALAI',
    );

    expect(permissionRequest).toBeDefined();
    expect(permissionRequest?.getProperties()?.onBehalfOf?.getValue()).toBe(
      'ownerChannel',
    );
    expect(
      permissionRequest?.getProperties()?.targetSessionId?.getValue(),
    ).toBe(PROVIDER_SESSION_ID);
  });

  it('subscribes after permission grant and marks readiness after subscription initiation', async () => {
    const initialized = await initializeDocument(buildAiCaller());
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const granted = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Single Document Permission Granted',
          inResponseTo: {
            requestId: 'REQ_MEALAI',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const subscribeEvent = granted.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(subscribeEvent).toBeDefined();
    expect(
      subscribeEvent
        ?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_MEALAI');
    expect(String(granted.document.get('/mealAI/status'))).toBe('pending');

    const ready = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: granted.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription to Session Initiated',
          subscriptionId: 'SUB_MEALAI',
          targetSessionId: PROVIDER_SESSION_ID,
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(ready.document.get('/mealAI/status'))).toBe('ready');
  });

  it('emits provider call-operation requests with requester, task, instructions, and context', async () => {
    const built = DocBuilder.doc()
      .name('AI ask integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .field('/prompt', 'Summarize the request')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('summarize')
      .instruction('Return concise JSON.')
      .expects('Conversation/Chat Message')
      .done()
      .done()
      .operation('askProvider')
      .channel('ownerChannel')
      .requestType('Text')
      .description('Ask the provider')
      .steps((steps) =>
        steps.askAI('mealAI', 'AskProvider', (ask) =>
          ask
            .task('summarize')
            .instruction(DocBuilder.expr("document('/prompt')"))
            .instruction('Input: ${event.message.request}'),
        ),
      )
      .done()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: OWNER_TIMELINE_ID,
      operation: 'askProvider',
      request: 'What should I cook?',
    });

    const askEvent = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );

    expect(askEvent).toBeDefined();
    expect(askEvent?.getProperties()?.onBehalfOf?.getValue()).toBe(
      'ownerChannel',
    );
    expect(askEvent?.getProperties()?.targetSessionId?.getValue()).toBe(
      PROVIDER_SESSION_ID,
    );
    expect(askEvent?.getProperties()?.operation?.getValue()).toBe(
      'provideInstructions',
    );
    expect(
      askEvent
        ?.getProperties()
        ?.request?.getProperties()
        ?.requester?.getValue(),
    ).toBe('MEALAI');
    expect(
      askEvent?.getProperties()?.request?.getProperties()?.taskName?.getValue(),
    ).toBe('summarize');
    const requestContext = askEvent
      ?.getProperties()
      ?.request?.getProperties()?.context;
    expect(requestContext).toBeDefined();
    expect(
      initialized.blue.nodeToJson(
        requestContext as NonNullable<typeof requestContext>,
      ),
    ).toEqual({});
    expect(
      askEvent
        ?.getProperties()
        ?.request?.getProperties()
        ?.expectedResponses?.getItems()?.[0]
        ?.getBlueId() ??
        askEvent
          ?.getProperties()
          ?.request?.getProperties()
          ?.expectedResponses?.getItems()?.[0]
          ?.getType()
          ?.getBlueId(),
    ).toBe(conversationBlueIds['Conversation/Chat Message']);

    const instructions = askEvent
      ?.getProperties()
      ?.request?.getProperties()
      ?.instructions?.getValue();
    expect(String(instructions)).toContain('Summarize the request');
    expect(String(instructions)).toContain('What should I cook?');
  });

  it('saves AI context before running response handlers', async () => {
    const built = DocBuilder.doc()
      .name('AI response integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .field('/result/status', 'idle')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER')
      .done()
      .onAIResponse('mealAI', 'onProviderResponse', (steps) =>
        steps.replaceValue('MarkDone', '/result/status', 'done'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_MEALAI',
          update: {
            type: 'Conversation/Response',
            status: 'ok',
            context: {
              turn: 2,
            },
            inResponseTo: {
              incomingEvent: {
                requester: 'MEAL_PLANNER',
              },
            },
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(processed.document.get('/result/status'))).toBe('done');
    expect(processed.document.getAsInteger('/mealAI/context/turn')).toBe(2);
  });

  it('supports task-filtered and explicit-type response matching at runtime', async () => {
    const built = DocBuilder.doc()
      .name('AI filtered response integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .field('/result/status', 'idle')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requesterId('MEAL_PLANNER')
      .task('summarize')
      .instruction('Summarize.')
      .done()
      .done()
      .onAIResponse(
        'mealAI',
        'onChatMessage',
        'Conversation/Chat Message',
        'summarize',
        (steps) => steps.replaceValue('MarkSeen', '/result/status', 'seen'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const wrongTask = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_MEALAI',
          update: {
            type: 'Conversation/Chat Message',
            message: 'hello',
            context: {},
            inResponseTo: {
              incomingEvent: {
                requester: 'MEAL_PLANNER',
                taskName: 'other',
              },
            },
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(wrongTask.document.get('/result/status'))).toBe('idle');

    const matched = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: wrongTask.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_MEALAI',
          update: {
            type: 'Conversation/Chat Message',
            message: 'hello',
            context: {},
            inResponseTo: {
              incomingEvent: {
                requester: 'MEAL_PLANNER',
                taskName: 'summarize',
              },
            },
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(matched.document.get('/result/status'))).toBe('seen');
  });

  it('documents the current public-runtime limitation for named-event AI response matching', async () => {
    const built = DocBuilder.doc()
      .name('AI named event response integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .field('/result/status', 'idle')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requesterId('MEAL_PLANNER')
      .task('summarize')
      .instruction('Summarize.')
      .done()
      .done()
      .onAIResponse(
        'mealAI',
        'onNamedReady',
        { namedEvent: 'summary-ready' },
        'summarize',
        (steps) => steps.replaceValue('MarkSeen', '/result/status', 'seen'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    try {
      await processOperationRequest({
        blue: initialized.blue,
        processor: initialized.processor,
        document: initialized.document,
        timelineId: ADMIN_TIMELINE_ID,
        operation: 'myOsAdminUpdate',
        request: [
          {
            type: 'MyOS/Subscription Update',
            subscriptionId: 'SUB_MEALAI',
            update: {
              type: 'Common/Named Event',
              name: 'summary-ready',
              context: {
                turn: 1,
              },
              inResponseTo: {
                incomingEvent: {
                  requester: 'MEAL_PLANNER',
                  taskName: 'summarize',
                },
              },
            },
          },
        ],
        allowNewerVersion: false,
        documentBlueId: storedBlueId,
      });
      throw new Error(
        'Expected named-event AI matcher processing to fail on the public runtime',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        'Unknown type "Common/Named Event"',
      );
    }
  });

  it('supports manual permission requests through steps.ai(...).requestPermission()', async () => {
    const built = DocBuilder.doc()
      .name('AI manual permission integration')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/llmProviderSessionId', PROVIDER_SESSION_ID)
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requestPermissionManually()
      .done()
      .operation('activateAI')
      .channel('ownerChannel')
      .requestType('Text')
      .description('Activate AI')
      .steps((steps) => steps.ai('mealAI').requestPermission('RequestNow'))
      .done()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: OWNER_TIMELINE_ID,
      operation: 'activateAI',
      request: 'activate',
    });

    const permissionRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Single Document Permission Grant Requested'],
    );

    expect(permissionRequest).toBeDefined();
    expect(permissionRequest?.getProperties()?.requestId?.getValue()).toBe(
      'REQ_MEALAI',
    );
  });

  it('keeps multiple AI integrations isolated at runtime', async () => {
    const built = DocBuilder.doc()
      .name('AI isolation integration')
      .channel('aliceChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'ai-analyst-owner',
      })
      .channel('bobChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'ai-validator-owner',
      })
      .field('/aliceSessionId', 'provider-a')
      .field('/bobSessionId', 'provider-b')
      .field('/state/analyst', 'idle')
      .field('/state/validator', 'idle')
      .ai('analyst')
      .sessionId(DocBuilder.expr("document('/aliceSessionId')"))
      .permissionFrom('aliceChannel')
      .requesterId('ALICE_ANALYST')
      .done()
      .ai('validator')
      .sessionId(DocBuilder.expr("document('/bobSessionId')"))
      .permissionFrom('bobChannel')
      .requesterId('BOB_VALIDATOR')
      .done()
      .onAIResponse('analyst', 'onAnalyst', (steps) =>
        steps.replaceValue('MarkAnalyst', '/state/analyst', 'done'),
      )
      .onAIResponse('validator', 'onValidator', (steps) =>
        steps.replaceValue('MarkValidator', '/state/validator', 'done'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_VALIDATOR',
          update: {
            type: 'Conversation/Response',
            status: 'ok',
            context: {},
            inResponseTo: {
              incomingEvent: {
                requester: 'BOB_VALIDATOR',
              },
            },
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(processed.document.get('/state/analyst'))).toBe('idle');
    expect(String(processed.document.get('/state/validator'))).toBe('done');
    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          myOsBlueIds['MyOS/Single Document Permission Grant Requested'],
      ),
    ).toBe(true);
    expect(conversationBlueIds['Conversation/Response']).toBeDefined();
  });
});
