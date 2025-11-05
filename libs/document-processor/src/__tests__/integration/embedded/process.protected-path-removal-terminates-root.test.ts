import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  stringProperty,
  terminatedMarker,
  makeTimelineEntry,
} from '../../test-utils.js';

const blue = createBlue();

describe('Process Embedded — Protected path removal terminates root', () => {
  it('terminates the root scope when attempting to remove an embedded path at runtime', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Toggle Embedded Doc
child:
  count: 0
  contracts:
    childTimeline:
      type: Timeline Channel
      timelineId: child
    incrementChild:
      type: Sequential Workflow
      channel: childTimeline
      steps:
        - name: IncrementChild
          type: Update Document
          changeset:
            - op: REPLACE
              path: /count
              val: "\${document('count') + 1}"
contracts:
  rootTimeline:
    type: Timeline Channel
    timelineId: root
  embedded:
    type: Process Embedded
    paths:
      - /child
  removeEmbeddedPath:
    type: Sequential Workflow
    channel: rootTimeline
    order: 1
    steps:
      - name: RemoveMarker
        type: Update Document
        changeset:
          - op: REMOVE
            path: /contracts/embedded/paths/0
  rootWriteAttempt:
    type: Sequential Workflow
    channel: rootTimeline
    order: 2
    steps:
      - name: RootIncrement
        type: Update Document
        changeset:
          - op: REPLACE
            path: /child/count
            val: "\${document('/child/count') + 1}"
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const toggleEvent = makeTimelineEntry(blue, 'root', 'remove embedded path');
    const afterToggle = await expectOk(
      processor.processDocument(initialized.document, toggleEvent),
    );

    const termination = terminatedMarker(afterToggle.document, '/');
    expect(termination).not.toBeNull();
    expect(stringProperty(termination!, 'cause')).toBe('fatal');

    const childAfterToggle = property(afterToggle.document, 'child');
    expect(numericValue(property(childAfterToggle, 'count'))).toBe(0);
  });
});
