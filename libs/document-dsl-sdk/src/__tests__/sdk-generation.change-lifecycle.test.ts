import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';

describe('sdk generation: change lifecycle', () => {
  it('emits direct/propose/accept/reject change operations + workflows', () => {
    const yaml = DocBuilder.doc()
      .name('Change lifecycle')
      .channel('ownerChannel')
      .contractsPolicy({ requireSectionChanges: true })
      .directChange('directChange', 'ownerChannel', 'Apply direct changes')
      .proposeChange(
        'proposeChange',
        'ownerChannel',
        'Order',
        'Propose changes',
      )
      .acceptChange('acceptChange', 'ownerChannel', 'Order', 'Accept changes')
      .rejectChange('rejectChange', 'ownerChannel', 'Order', 'Reject changes')
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Change lifecycle
contracts:
  ownerChannel:
    type: Core/Channel
  contractsPolicy:
    type: Conversation/Contracts Change Policy
    requireSectionChanges: true
  directChange:
    type: Conversation/Change Operation
    channel: ownerChannel
    description: Apply direct changes
    request:
      type: Conversation/Change Request
  directChangeImpl:
    type: Conversation/Change Workflow
    operation: directChange
  proposeChange:
    type: Conversation/Propose Change Operation
    channel: ownerChannel
    description: Propose changes
    request:
      type: Conversation/Change Request
  proposeChangeImpl:
    type: Conversation/Propose Change Workflow
    operation: proposeChange
    postfix: Order
  acceptChange:
    type: Conversation/Accept Change Operation
    channel: ownerChannel
    description: Accept changes
    request:
      type: Conversation/Change Request
  acceptChangeImpl:
    type: Conversation/Accept Change Workflow
    operation: acceptChange
    postfix: Order
  rejectChange:
    type: Conversation/Reject Change Operation
    channel: ownerChannel
    description: Reject changes
    request:
      type: Conversation/Change Request
  rejectChangeImpl:
    type: Conversation/Reject Change Workflow
    operation: rejectChange
    postfix: Order
`.trim(),
    );
  });
});
