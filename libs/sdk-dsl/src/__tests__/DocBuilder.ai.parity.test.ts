/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderAiDslParityTest.java
*/

import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';

function textAt(node: BlueNode, path: string): string {
  const value = node.get(path);
  if (value instanceof BlueNode) {
    return String(value.getValue() ?? value.getBlueId() ?? value);
  }
  return String(value);
}

function blueIdAt(node: BlueNode, path: string): string | undefined {
  const target = node.getAsNode(path);
  return target?.getBlueId() ?? target?.getType()?.getBlueId();
}

describe('DocBuilder AI parity', () => {
  it('builds AI integration scaffolding with runtime-correct permission and subscribe flows', () => {
    const built = DocBuilder.doc()
      .name('AI integration parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-llm-1')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER')
      .done()
      .buildDocument();

    expect(String(built.get('/mealAI/status'))).toBe('pending');
    expect(
      Object.keys(built.getAsNode('/mealAI/context')?.getProperties() ?? {}),
    ).toHaveLength(0);
    expect(blueIdAt(built, '/contracts/ownerChannel')).toBeDefined();
    expect(blueIdAt(built, '/contracts/myOsAdminChannel')).toBe(
      myOsBlueIds['MyOS/MyOS Timeline Channel'],
    );
    expect(textAt(built, '/contracts/myOsAdminUpdate/channel')).toBe(
      'myOsAdminChannel',
    );
    expect(textAt(built, '/contracts/aiMEALAIRequestPermission/channel')).toBe(
      'initLifecycleChannel',
    );
    expect(
      blueIdAt(built, '/contracts/aiMEALAIRequestPermission/steps/0/event'),
    ).toBe(myOsBlueIds['MyOS/Single Document Permission Grant Requested']);
    expect(
      textAt(
        built,
        '/contracts/aiMEALAIRequestPermission/steps/0/event/requestId',
      ),
    ).toBe('REQ_MEALAI');
    expect(
      textAt(
        built,
        '/contracts/aiMEALAISubscribe/steps/0/event/subscription/id',
      ),
    ).toBe('SUB_MEALAI');
    expect(
      textAt(
        built,
        '/contracts/aiMEALAISubscriptionReady/steps/0/changeset/0/val',
      ),
    ).toBe('ready');
    expect(
      textAt(
        built,
        '/contracts/aiMEALAIPermissionRejected/steps/0/changeset/0/val',
      ),
    ).toBe('revoked');
  });

  it('builds askAI call-operation requests with context, requester, and prompt expression merging', () => {
    const built = DocBuilder.doc()
      .name('AI ask parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-llm-2')
      .field('/prompt', 'Return JSON only')
      .field('/maxCalories', 3000)
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER')
      .done()
      .operation('requestMealPlan')
      .channel('ownerChannel')
      .description('Request meal plan')
      .steps((steps) =>
        steps.askAI('mealAI', 'GeneratePlan', (ask) =>
          ask
            .instruction(DocBuilder.expr("document('/prompt')"))
            .instruction("Keep total calories <= ${document('/maxCalories')}")
            .instruction('Meal request: ${event.message.request}'),
        ),
      )
      .done()
      .buildDocument();

    const eventPath = '/contracts/requestMealPlanImpl/steps/0/event';
    expect(blueIdAt(built, `${eventPath}`)).toBe(
      myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(textAt(built, `${eventPath}/onBehalfOf`)).toBe('ownerChannel');
    expect(textAt(built, `${eventPath}/targetSessionId`)).toBe(
      "${document('/llmProviderSessionId')}",
    );
    expect(textAt(built, `${eventPath}/operation`)).toBe('provideInstructions');
    expect(textAt(built, `${eventPath}/request/requester`)).toBe(
      'MEAL_PLANNER',
    );
    expect(textAt(built, `${eventPath}/request/context`)).toBe(
      "${document('/mealAI/context')}",
    );

    const instructions = textAt(built, `${eventPath}/request/instructions`);
    expect(instructions).toContain("document('/prompt')");
    expect(instructions).toContain("document('/maxCalories')");
    expect(instructions).toContain('event.message.request');
  });

  it('prepends AI context persistence to response handlers', () => {
    const built = DocBuilder.doc()
      .name('AI response parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-llm-3')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER')
      .done()
      .onAIResponse('mealAI', 'onMealPlan', (steps) =>
        steps.replaceValue('MarkDone', '/mealAI/lastResult', 'processed'),
      )
      .buildDocument();

    const workflow = '/contracts/onMealPlan';
    expect(textAt(built, `${workflow}/channel`)).toBe('triggeredEventChannel');
    expect(blueIdAt(built, `${workflow}/event`)).toBe(
      myOsBlueIds['MyOS/Subscription Update'],
    );
    expect(textAt(built, `${workflow}/event/subscriptionId`)).toBe(
      'SUB_MEALAI',
    );
    expect(blueIdAt(built, `${workflow}/event/update`)).toBe(
      conversationBlueIds['Conversation/Response'],
    );
    expect(
      textAt(
        built,
        `${workflow}/event/update/inResponseTo/incomingEvent/requester`,
      ),
    ).toBe('MEAL_PLANNER');
    expect(textAt(built, `${workflow}/steps/0/changeset/0/path`)).toBe(
      '/mealAI/context',
    );
    expect(textAt(built, `${workflow}/steps/0/changeset/0/val`)).toBe(
      '${event.update.context}',
    );
    expect(textAt(built, `${workflow}/steps/1/changeset/0/path`)).toBe(
      '/mealAI/lastResult',
    );
  });

  it('keeps multiple AI integrations isolated', () => {
    const built = DocBuilder.doc()
      .name('Two AI parity')
      .channels('aliceChannel', 'bobChannel')
      .field('/aliceSessionId', 'session-a')
      .field('/bobSessionId', 'session-b')
      .ai('analyst')
      .sessionId(DocBuilder.expr("document('/aliceSessionId')"))
      .permissionFrom('aliceChannel')
      .contextPath('/integrations/analyst/context')
      .statusPath('/integrations/analyst/status')
      .requesterId('ALICE_ANALYST')
      .done()
      .ai('validator')
      .sessionId(DocBuilder.expr("document('/bobSessionId')"))
      .permissionFrom('bobChannel')
      .contextPath('/integrations/validator/context')
      .statusPath('/integrations/validator/status')
      .requesterId('BOB_VALIDATOR')
      .done()
      .onInit('kickoff', (steps) =>
        steps
          .askAI('analyst', 'AskAnalyst', (ask) => ask.instruction('Analyze'))
          .askAI('validator', 'AskValidator', (ask) =>
            ask.instruction('Validate'),
          ),
      )
      .buildDocument();

    const first = '/contracts/kickoff/steps/0/event';
    expect(textAt(built, `${first}/onBehalfOf`)).toBe('aliceChannel');
    expect(textAt(built, `${first}/targetSessionId`)).toBe(
      "${document('/aliceSessionId')}",
    );
    expect(textAt(built, `${first}/request/requester`)).toBe('ALICE_ANALYST');

    const second = '/contracts/kickoff/steps/1/event';
    expect(textAt(built, `${second}/onBehalfOf`)).toBe('bobChannel');
    expect(textAt(built, `${second}/targetSessionId`)).toBe(
      "${document('/bobSessionId')}",
    );
    expect(textAt(built, `${second}/request/requester`)).toBe('BOB_VALIDATOR');
  });

  it('supports explicit AI response types', () => {
    const built = DocBuilder.doc()
      .name('AI explicit type parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-llm-4')
      .ai('mealAI')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/mealAI/status')
      .contextPath('/mealAI/context')
      .requesterId('MEAL_PLANNER')
      .done()
      .onAIResponse(
        'mealAI',
        'onChatMessage',
        'Conversation/Chat Message',
        (steps) => steps.replaceValue('MarkSeen', '/mealAI/seen', true),
      )
      .buildDocument();

    expect(blueIdAt(built, '/contracts/onChatMessage/event/update')).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    expect(
      built
        .getContracts()
        ?.onChatMessage?.getProperties()
        ?.event?.getProperties()
        ?.update?.getProperties()
        ?.inResponseTo?.getProperties()
        ?.incomingEvent?.getProperties()
        ?.requester?.getValue(),
    ).toBe('MEAL_PLANNER');
  });

  it('supports task templates and inline expected responses', () => {
    const built = DocBuilder.doc()
      .name('AI task parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-tasks')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('summarize')
      .instruction('Summarize input in bullet points.')
      .expects('Conversation/Chat Message')
      .expectsNamed('meal-plan-ready', (fields) =>
        fields.field('planId', 'Plan identifier').field('totalCalories'),
      )
      .done()
      .done()
      .operation('run')
      .channel('ownerChannel')
      .steps((steps) =>
        steps.askAI('provider', 'RunTask', (ask) =>
          ask
            .task('summarize')
            .expectsNamed('meal-plan-warning')
            .instruction('Input: ${event.message.request}'),
        ),
      )
      .done()
      .buildDocument();

    const requestPath = '/contracts/runImpl/steps/0/event/request';
    expect(textAt(built, `${requestPath}/taskName`)).toBe('summarize');
    expect(blueIdAt(built, `${requestPath}/expectedResponses/0`)).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    expect(textAt(built, `${requestPath}/expectedResponses/1/type`)).toBe(
      'Common/Named Event',
    );
    expect(textAt(built, `${requestPath}/expectedResponses/1/name`)).toBe(
      'meal-plan-ready',
    );
    expect(
      textAt(
        built,
        `${requestPath}/expectedResponses/1/payload/planId/description`,
      ),
    ).toBe('Plan identifier');
    expect(textAt(built, `${requestPath}/expectedResponses/2/name`)).toBe(
      'meal-plan-warning',
    );
  });

  it('supports named expected-response field varargs', () => {
    const built = DocBuilder.doc()
      .name('AI named varargs parity')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-varargs')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('summarize')
      .instruction('Summarize.')
      .expectsNamed('summary-ready', 'summaryId', 'quality')
      .done()
      .done()
      .operation('run')
      .channel('ownerChannel')
      .steps((steps) =>
        steps.askAI('provider', 'RunTask', (ask) =>
          ask
            .task('summarize')
            .instruction('Input: ${event.message.request}')
            .expectsNamed('summary-warning', 'code', 'message'),
        ),
      )
      .done()
      .buildDocument();

    const requestPath = '/contracts/runImpl/steps/0/event/request';
    expect(textAt(built, `${requestPath}/expectedResponses/0/name`)).toBe(
      'summary-ready',
    );
    expect(
      built.getAsNode(`${requestPath}/expectedResponses/0/payload/summaryId`),
    ).toBeDefined();
    expect(
      built.getAsNode(`${requestPath}/expectedResponses/0/payload/quality`),
    ).toBeDefined();
    expect(textAt(built, `${requestPath}/expectedResponses/1/name`)).toBe(
      'summary-warning',
    );
  });

  it('builds permission workflows for on-event and doc-change timing modes', () => {
    const onEvent = DocBuilder.doc()
      .name('AI permission on event')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-evt')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requestPermissionOnEvent('Conversation/Chat Message')
      .done()
      .buildDocument();

    expect(
      textAt(onEvent, '/contracts/aiPROVIDERRequestPermission/channel'),
    ).toBe('triggeredEventChannel');
    expect(
      blueIdAt(onEvent, '/contracts/aiPROVIDERRequestPermission/event'),
    ).toBe(conversationBlueIds['Conversation/Chat Message']);

    const onDocChange = DocBuilder.doc()
      .name('AI permission on doc change')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-doc')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requestPermissionOnDocChange('/status')
      .done()
      .buildDocument();

    expect(
      blueIdAt(
        onDocChange,
        '/contracts/aiPROVIDERRequestPermissionDocUpdateChannel',
      ),
    ).toBeDefined();
    expect(
      textAt(
        onDocChange,
        '/contracts/aiPROVIDERRequestPermissionDocUpdateChannel/path',
      ),
    ).toBe('/status');
  });

  it('supports manual permission flow and task-filtered response matchers', () => {
    const built = DocBuilder.doc()
      .name('AI permission manual')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-manual')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('summarize')
      .instruction('Summarize.')
      .done()
      .requestPermissionManually()
      .done()
      .operation('activate')
      .channel('ownerChannel')
      .steps((steps) => steps.ai('provider').requestPermission('RequestNow'))
      .done()
      .onAIResponse(
        'provider',
        'onSummary',
        'Conversation/Chat Message',
        'summarize',
        (steps) => steps.replaceValue('MarkSeen', '/seen', true),
      )
      .buildDocument();

    expect(built.getContracts()?.aiPROVIDERRequestPermission).toBeUndefined();
    expect(textAt(built, '/contracts/activateImpl/steps/0/name')).toBe(
      'RequestNow',
    );
    expect(
      textAt(
        built,
        '/contracts/onSummary/event/update/inResponseTo/incomingEvent/taskName',
      ),
    ).toBe('summarize');
  });

  it('builds explicit AI step helpers for permission and subscribe', () => {
    const built = DocBuilder.doc()
      .name('AI explicit step helpers')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-manual')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .requestPermissionManually()
      .done()
      .operation('activate')
      .channel('ownerChannel')
      .steps((steps) =>
        steps
          .ai('provider')
          .requestPermission('RequestNow')
          .ai('provider')
          .subscribe('SubscribeNow'),
      )
      .done()
      .buildDocument();

    expect(blueIdAt(built, '/contracts/activateImpl/steps/0/event')).toBe(
      myOsBlueIds['MyOS/Single Document Permission Grant Requested'],
    );
    expect(
      textAt(built, '/contracts/activateImpl/steps/0/event/requestId'),
    ).toBe('REQ_PROVIDER');
    expect(blueIdAt(built, '/contracts/activateImpl/steps/1/event')).toBe(
      myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(
      textAt(built, '/contracts/activateImpl/steps/1/event/subscription/id'),
    ).toBe('SUB_PROVIDER');
  });

  it('supports named-event AI response matchers with requester and optional task filtering', () => {
    const built = DocBuilder.doc()
      .name('AI named event matcher')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-named-task-response')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('summarize')
      .instruction('Summarize.')
      .done()
      .done()
      .onAIResponse(
        'provider',
        'onMealPlanReady',
        { namedEvent: 'meal-plan-ready' },
        'summarize',
        (steps) => steps.replaceValue('MarkSeen', '/seen', true),
      )
      .buildDocument();

    expect(
      textAt(built, '/contracts/onMealPlanReady/event/subscriptionId'),
    ).toBe('SUB_PROVIDER');
    expect(textAt(built, '/contracts/onMealPlanReady/event/update/type')).toBe(
      'Common/Named Event',
    );
    expect(textAt(built, '/contracts/onMealPlanReady/event/update/name')).toBe(
      'meal-plan-ready',
    );
    expect(
      textAt(
        built,
        '/contracts/onMealPlanReady/event/update/inResponseTo/incomingEvent/requester',
      ),
    ).toBe('PROVIDER');
    expect(
      textAt(
        built,
        '/contracts/onMealPlanReady/event/update/inResponseTo/incomingEvent/taskName',
      ),
    ).toBe('summarize');
  });

  it('rejects missing AI integrations, unknown tasks, duplicate tasks, and empty instructions', () => {
    expect(() =>
      DocBuilder.doc()
        .name('AI unknown integration')
        .operation('ask')
        .channel('ownerChannel')
        .steps((steps) =>
          steps.askAI('missing', (ask) => ask.instruction('hi')),
        )
        .done()
        .buildDocument(),
    ).toThrow(/Unknown AI integration/);

    expect(() =>
      DocBuilder.doc()
        .name('AI unknown task')
        .channel('ownerChannel')
        .field('/llmProviderSessionId', 'session-task-missing')
        .ai('provider')
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom('ownerChannel')
        .task('known')
        .instruction('known instruction')
        .done()
        .done()
        .operation('run')
        .channel('ownerChannel')
        .steps((steps) => steps.askAI('provider', (ask) => ask.task('missing')))
        .done()
        .buildDocument(),
    ).toThrow(/Unknown task 'missing'/);

    expect(() =>
      DocBuilder.doc()
        .name('AI bad response task')
        .channel('ownerChannel')
        .field('/llmProviderSessionId', 'session-bad-response-task')
        .ai('provider')
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom('ownerChannel')
        .task('known')
        .instruction('known')
        .done()
        .done()
        .onAIResponse(
          'provider',
          'onBad',
          'Conversation/Chat Message',
          'missing',
          () => {
            return;
          },
        )
        .buildDocument(),
    ).toThrow(/Unknown task 'missing'/);

    expect(() =>
      DocBuilder.doc()
        .name('AI bad task')
        .channel('ownerChannel')
        .field('/llmProviderSessionId', 'session-bad-task')
        .ai('provider')
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom('ownerChannel')
        .task('empty')
        .done()
        .done()
        .buildDocument(),
    ).toThrow(/at least one instruction/);

    expect(() =>
      DocBuilder.doc()
        .name('AI duplicate task')
        .channel('ownerChannel')
        .field('/llmProviderSessionId', 'session-dup-task')
        .ai('provider')
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom('ownerChannel')
        .task('same')
        .instruction('one')
        .done()
        .task('same')
        .instruction('two')
        .done()
        .done()
        .buildDocument(),
    ).toThrow(/Duplicate AI task name/);

    expect(() =>
      DocBuilder.doc()
        .name('AI empty ask')
        .channel('ownerChannel')
        .field('/llmProviderSessionId', 'session-empty')
        .ai('provider')
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom('ownerChannel')
        .done()
        .operation('run')
        .channel('ownerChannel')
        .steps((steps) =>
          steps.askAI('provider', () => {
            return;
          }),
        )
        .done()
        .buildDocument(),
    ).toThrow(/at least one instruction/);
  });

  it('uses type nodes for explicit expected response entries', () => {
    const built = DocBuilder.doc()
      .name('AI expected response node shape')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-shape')
      .ai('provider')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .task('answer')
      .instruction('Answer.')
      .expects('Conversation/Chat Message')
      .done()
      .done()
      .operation('run')
      .channel('ownerChannel')
      .steps((steps) =>
        steps.askAI('provider', (ask) => ask.task('answer').instruction('Go')),
      )
      .done()
      .buildDocument();

    expect(
      blueIdAt(
        built,
        '/contracts/runImpl/steps/0/event/request/expectedResponses/0',
      ),
    ).toBe(conversationBlueIds['Conversation/Chat Message']);
    expect(conversationBlueIds['Conversation/Chat Message']).toBeDefined();
  });
});
