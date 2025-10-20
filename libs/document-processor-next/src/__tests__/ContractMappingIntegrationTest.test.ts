import { expect, it, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Blue } from '@blue-labs/language';

import {
  channelEventCheckpointSchema,
  documentUpdateChannelSchema,
  embeddedNodeChannelSchema,
  initializationMarkerSchema,
  lifecycleChannelSchema,
  processEmbeddedMarkerSchema,
  processingFailureMarkerSchema,
  triggeredEventChannelSchema,
} from '../model/index.js';
import { setPropertySchema } from './models/index.js';
import { property } from './test-utils.js';

const blue = new Blue();

describe('ContractMappingIntegrationTest', () => {
  it('loadsAllContractsFromBlueYaml', () => {
    const filePath = fileURLToPath(
      new URL(
        '../../../../../blue-language-java/src/test/resources/processor/contracts/all-contracts.blue',
        import.meta.url
      )
    );
    const yaml = readFileSync(filePath, 'utf-8');

    const document = blue.yamlToNode(yaml);
    const contractsNode = property(document, 'contracts');
    const entries = contractsNode.getProperties() ?? {};

    const embedded = blue.nodeToSchemaOutput(
      entries.embedded,
      processEmbeddedMarkerSchema
    );
    expect(embedded.paths).toHaveLength(2);

    const updateContract = blue.nodeToSchemaOutput(
      entries.documentUpdate,
      documentUpdateChannelSchema
    );
    expect(updateContract.path).toBe('/');

    const triggered = blue.nodeToSchemaOutput(
      entries.triggered,
      triggeredEventChannelSchema
    );
    expect(triggered).toBeDefined();

    const lifecycle = blue.nodeToSchemaOutput(
      entries.lifecycleChannel,
      lifecycleChannelSchema
    );
    expect(lifecycle).toBeDefined();

    const embeddedNode = blue.nodeToSchemaOutput(
      entries.embeddedNode,
      embeddedNodeChannelSchema
    );
    expect(embeddedNode.childPath).toBe('/payment');

    const checkpoint = blue.nodeToSchemaOutput(
      entries.checkpoint,
      channelEventCheckpointSchema
    );
    const storedEvent = checkpoint.lastEvents?.external ?? null;
    expect(storedEvent).toBeDefined();
    const storedId = storedEvent
      ?.getProperties()
      ?.eventId?.getValue();
    expect(storedId).toBe('evt-001');

    const initialized = blue.nodeToSchemaOutput(
      entries.initialized,
      initializationMarkerSchema
    );
    expect(initialized.documentId).toBe('doc-123');

    const failure = blue.nodeToSchemaOutput(
      entries.failure,
      processingFailureMarkerSchema
    );
    expect(failure.code).toBe('RuntimeFatal');
    expect(failure.reason).toBe('boundary violation');

    const setProperty = blue.nodeToSchemaOutput(
      entries.setProperty,
      setPropertySchema
    );
    expect(setProperty.channelKey ?? setProperty.channel).toBe(
      'lifecycleChannel'
    );
    expect(setProperty.propertyKey).toBe('/x');
    expect(setProperty.propertyValue).toBe(7);
    expect(setProperty.path).toBe('/custom/path/');
  });
});
