import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('ai integration mapping', () => {
  it('maps ai integration registration and lifecycle helpers', () => {
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
});
