import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  propertyOptional,
  stringProperty,
  terminatedMarker,
  makeTimelineEntry,
} from '../../test-utils.js';

const blue = createBlue();

const MULTI_PATH_BASE_YAML = `name: Multi Path Protected
childA:
  count: 0
  contracts:
    alphaTimeline:
      type: Timeline Channel
      timelineId: alpha
    incrementA:
      type: Sequential Workflow
      channel: alphaTimeline
      steps:
        - name: IncrementA
          type: Update Document
          changeset:
            - op: REPLACE
              path: /count
              val: "\${document('count') + 1}"
childB:
  count: 0
  contracts:
    betaTimeline:
      type: Timeline Channel
      timelineId: beta
    incrementB:
      type: Sequential Workflow
      channel: betaTimeline
      steps:
        - name: IncrementB
          type: Update Document
          changeset:
            - op: REPLACE
              path: /count
              val: "\${document('count') + 1}"
contracts:
  embedded:
    type: Process Embedded
    paths:
      - /childA
      - /childB
`;

describe('Process Embedded — Multi-paths: independent processing and protection', () => {
  it('runs each embedded child workflow independently while both paths are protected', async () => {
    const processor = buildProcessor(blue);
    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(MULTI_PATH_BASE_YAML)),
    );

    const afterAlpha = await expectOk(
      processor.processDocument(
        initialized.document,
        makeTimelineEntry(blue, 'alpha', 'event for childA'),
      ),
    );
    const childAAfterAlpha = property(afterAlpha.document, 'childA');
    const childBAfterAlpha = property(afterAlpha.document, 'childB');
    expect(numericValue(property(childAAfterAlpha, 'count'))).toBe(1);
    expect(numericValue(property(childBAfterAlpha, 'count'))).toBe(0);
    expect(terminatedMarker(afterAlpha.document, '/')).toBeNull();

    const afterBeta = await expectOk(
      processor.processDocument(
        afterAlpha.document.clone(),
        makeTimelineEntry(blue, 'beta', 'event for childB'),
      ),
    );
    const childAAfterBeta = property(afterBeta.document, 'childA');
    const childBAfterBeta = property(afterBeta.document, 'childB');
    expect(numericValue(property(childAAfterBeta, 'count'))).toBe(1);
    expect(numericValue(property(childBAfterBeta, 'count'))).toBe(1);
    expect(terminatedMarker(afterBeta.document, '/')).toBeNull();
  });

  it('terminates the root scope when writing into either protected subtree', async () => {
    const assertRootTermination = async (target: 'childA' | 'childB') => {
      const processor = buildProcessor(blue);
      const yaml = `${MULTI_PATH_BASE_YAML}  rootTimeline:
    type: Timeline Channel
    timelineId: root
  rootWrite:
    type: Sequential Workflow
    channel: rootTimeline
    steps:
      - name: RootWrite
        type: Update Document
        changeset:
          - op: REPLACE
            path: /${target}/count
            val: "\${document('/${target}/count') + 1}"
`;

      const initialized = await expectOk(
        processor.initializeDocument(blue.yamlToNode(yaml)),
      );
      const result = await expectOk(
        processor.processDocument(
          initialized.document,
          makeTimelineEntry(blue, 'root', `write ${target}`),
        ),
      );
      const termination = terminatedMarker(result.document, '/');
      expect(termination).not.toBeNull();
      expect(stringProperty(termination!, 'cause')).toBe('fatal');
      const childNode = property(result.document, target);
      expect(numericValue(property(childNode, 'count'))).toBe(0);
    };

    await assertRootTermination('childA');
    await assertRootTermination('childB');
  });

  it('removes an embedded child root without terminating the parent', async () => {
    const processor = buildProcessor(blue);
    const yaml = `${MULTI_PATH_BASE_YAML}  rootTimeline:
    type: Timeline Channel
    timelineId: root
  rootWrite:
    type: Sequential Workflow
    channel: rootTimeline
    steps:
      - name: RootRemoveChild
        type: Update Document
        changeset:
          - op: REMOVE
            path: /childA
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const result = await expectOk(
      processor.processDocument(
        initialized.document,
        makeTimelineEntry(blue, 'root', 'remove childA'),
      ),
    );
    const termination = terminatedMarker(result.document, '/');
    expect(termination).toBeNull();
    expect(propertyOptional(result.document, 'childA')).toBeUndefined();
    expect(propertyOptional(result.document, 'childB')).toBeDefined();
  });
});
