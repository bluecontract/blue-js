import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('doc-builder change lifecycle mapping', () => {
  it('maps direct and propose/accept/reject change helpers', () => {
    const document = DocBuilder.doc()
      .name('Change Lifecycle')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .channel('reviewerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'reviewer-timeline',
      })
      .directChange('changeDocument', 'ownerChannel')
      .proposeChange('proposeText', 'ownerChannel', 'Text')
      .acceptChange('acceptText', 'reviewerChannel', 'Text')
      .rejectChange('rejectText', 'reviewerChannel', 'Text')
      .buildDocument();

    expect(toOfficialYaml(document)).toContain(`contractsPolicy:
    type: Conversation/Contracts Change Policy
    requireSectionChanges: true`);
    expect(toOfficialYaml(document)).toContain(`changeDocument:
    description: Apply Conversation/Change Request directly
    type: Conversation/Change Operation`);
    expect(toOfficialYaml(document)).toContain(`changeDocumentImpl:
    type: Conversation/Change Workflow`);
    expect(toOfficialYaml(document)).toContain(`proposeTextImpl:
    type: Conversation/Propose Change Workflow
    operation: proposeText
    postfix: Text`);
    expect(toOfficialYaml(document)).toContain(`acceptTextImpl:
    type: Conversation/Accept Change Workflow`);
    expect(toOfficialYaml(document)).toContain(`rejectTextImpl:
    type: Conversation/Reject Change Workflow`);
  });
});
