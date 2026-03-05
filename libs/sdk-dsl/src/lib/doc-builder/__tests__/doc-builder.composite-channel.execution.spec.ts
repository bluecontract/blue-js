import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('doc-builder composite channel execution', () => {
  it('maps composite channel operation wiring', () => {
    const document = DocBuilder.doc()
      .name('Composite Runtime')
      .field('/lastCompositeInvocation', null)
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .channel('allowedChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'allowed-timeline',
      })
      .compositeChannel('compositeChannel', 'ownerChannel', 'allowedChannel')
      .operation(
        'compositeOperation',
        'compositeChannel',
        'Composite invocation recorder',
        (steps) =>
          steps.replaceExpression(
            'RecordCompositeInvocation',
            '/lastCompositeInvocation',
            'event.message.operation',
          ),
      )
      .buildDocument();
    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`compositeChannel:
    type: Conversation/Composite Timeline Channel
    channels:
      - ownerChannel
      - allowedChannel`);
    expect(yaml).toContain(`compositeOperation:
    description: Composite invocation recorder
    type: Conversation/Operation
    channel: compositeChannel`);
  });
});
