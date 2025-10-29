import { createBlue } from '../test-support/blue.js';
import { describe, it, expect } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { SetPropertyContractProcessor } from './processors/index.js';
import { buildProcessor, expectErr, expectOk, property } from './test-utils.js';

const blue = createBlue();

describe('DocumentProcessorCapabilityTest', () => {
  it('initializeDocumentFailsWithCapabilityFailureWhenProcessorMissing', () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Doc
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  handler:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    propertyKey: /x
    propertyValue: 1
`;

    const document = blue.yamlToNode(yaml);
    const originalJson = JSON.stringify(blue.nodeToJson(document.clone()));

    const result = processor.initializeDocument(document);
    const failure = expectErr(result);
    expect(failure.failureReason?.toLowerCase()).toContain('unsupported');
    expect(failure.totalGas).toBe(0);
    expect(failure.triggeredEvents).toHaveLength(0);

    const afterJson = JSON.stringify(blue.nodeToJson(document.clone()));
    expect(afterJson).toBe(originalJson);
  });

  it('processDocumentFailsWithCapabilityFailureWhenNewUnsupportedContractAppears', () => {
    const processor = buildProcessor(blue, new SetPropertyContractProcessor());

    const baseYaml = `name: Base
contracts:
  lifecycleChannel:
    type: Lifecycle Event Channel
  handler:
    channel: lifecycleChannel
    type:
      blueId: SetProperty
    propertyKey: /x
    propertyValue: 1
`;

    const initialized = expectOk(
      processor.initializeDocument(blue.yamlToNode(baseYaml)),
    ).document.clone();
    const contracts = property(initialized, 'contracts');
    const unsupported = blue.jsonValueToNode({
      type: { blueId: 'TerminateScope' },
      channel: 'lifecycleChannel',
      mode: 'fatal',
      reason: 'test',
    });
    contracts.addProperty('unsupportedHandler', unsupported);

    const event = new BlueNode().setValue('event');
    const result = processor.processDocument(initialized, event);
    const failure = expectErr(result);
    expect(failure.failureReason?.toLowerCase()).toContain('unsupported');
    expect(failure.totalGas).toBe(0);
    expect(failure.triggeredEvents).toHaveLength(0);

    const storedContracts = property(initialized, 'contracts');
    expect(storedContracts.getProperties()).toHaveProperty(
      'unsupportedHandler',
    );
  });
});
