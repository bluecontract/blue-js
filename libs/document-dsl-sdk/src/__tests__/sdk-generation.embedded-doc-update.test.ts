import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';

describe('sdk generation: embedded processing and doc update channels', () => {
  it('builds embedded processing and document update subscriptions', () => {
    const yaml = DocBuilder.doc()
      .name('Embedded processing')
      .field('/children', [])
      .contract('processChildren', {
        type: 'Core/Process Embedded',
        path: '/children',
      })
      .contract('childrenUpdated', {
        type: 'Core/Document Update Channel',
        path: '/children',
      })
      .workflow('onChildrenUpdated', {
        channel: 'childrenUpdated',
        event: {
          type: 'Core/Document Update',
        },
        steps: [
          {
            name: 'MarkChildrenUpdated',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/childrenUpdated',
                val: true,
              },
            ],
          },
        ],
      })
      .toYaml();

    expect(yaml.trim()).toBe(
      `
name: Embedded processing
children: []
contracts:
  processChildren:
    type: Core/Process Embedded
    path: /children
  childrenUpdated:
    type: Core/Document Update Channel
    path: /children
  onChildrenUpdated:
    type: Conversation/Sequential Workflow
    channel: childrenUpdated
    event:
      type: Core/Document Update
    steps:
      - name: MarkChildrenUpdated
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /childrenUpdated
            val: true
`.trim(),
    );
  });
});
