import { describe, it } from 'vitest';
import { createBlue } from '../../../test-support/blue.js';
import { buildProcessor, expectOk } from '../../test-utils.js';

const blue = createBlue();

// Repro for: Incorrect processing of documents inside triggered events (“document leakage into root flow”)
// This test is intentionally skipped to avoid breaking the suite until the bug is fixed.
// It mirrors the scenario where Trigger Event payload includes a literal Blue document
// whose internal expressions should NOT be evaluated during emission.
describe('Trigger Event step — leakage into root flow (repro)', () => {
  it.skip('does not evaluate expressions inside nested document in Trigger Event payload (BUG)', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Leakage Repro Doc
counter: 0
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitStartWithChildDoc
        type: Trigger Event
        event:
          type: Chat Message
          message: start-session
          document:
            name: Child Session
            counter: 0
            contracts:
              increment:
                type: Operation
                request:
                  type: Integer
              incrementImpl:
                type: Sequential Workflow Operation
                operation: increment
                steps:
                  - name: IncreaseCounter
                    type: Update Document
                    changeset:
                      - op: replace
                        path: /counter
                        val: "\${document('counter') + event.request.value}"
`;
    // Expectation (after fix): initialization should succeed and not evaluate expressions
    // within the nested "document" under the Trigger Event payload.
    await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)));
  });
});
