import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('ai integration mapping', () => {
  it('maps ai integration registration and lifecycle helpers', () => {
    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .done()
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel`);
    expect(yaml).toContain(`myOsAdminUpdate:
    description: Operation for emitting events through channel
    type: Conversation/Operation`);
    expect(yaml).toContain(`markPROVIDERSubscriptionReady:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`ai:
  provider:
    status: idle
    context: {}`);
  });

  it('maps task-filtered and named AI response helpers', () => {
    // prettier-ignore
    const document = DocBuilder.doc()
      .name('AI Response Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .ai('provider')
        .sessionId('provider-session')
        .permissionFrom('ownerChannel')
        .requestPermissionManually()
        .task('summarize')
          .instruction('Summarize response')
          .done()
        .done()
      .onAIResponseForTask(
        'provider',
        'onSummaryResponse',
        'Conversation/Response',
        'summarize',
        (steps) => steps.replaceValue('SetDone', '/status', 'done'),
      )
      .onAINamedResponse(
        'provider',
        'onSummaryNamedEvent',
        'summary-ready',
        'summarize',
        (steps) => steps.replaceValue('SetNamedDone', '/status', 'named-done'),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`onSummaryResponse:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`taskName: summarize`);
    expect(yaml).toContain(`requester: PROVIDER`);
    expect(yaml).toContain(`onSummaryNamedEvent:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`name: summary-ready`);
  });
});
