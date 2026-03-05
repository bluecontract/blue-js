import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('interaction builders mapping', () => {
  it('maps access and agency listener helpers', () => {
    const document = DocBuilder.doc()
      .name('Access Mapping')
      .field('/granted', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .done()
      .onAccessGranted('counterAccess', 'markAccessGranted', (steps) =>
        steps.replaceValue('SetGranted', '/granted', true),
      )
      .onAgencyGranted('workerAgency', 'markAgencyGranted', (steps) =>
        steps.replaceValue('SetGrantedFromAgency', '/granted', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`markAccessGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Granted`);
    expect(yaml).toContain(`markAgencyGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Granted`);
  });
});
