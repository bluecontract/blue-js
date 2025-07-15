import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { EmbeddedDocumentModificationError } from '../utils/exceptions';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  return yaml.load(fs.readFileSync(resourcePath, 'utf8')) as any;
}

describe('Process Embedded – cross-boundary guard', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  const TIMELINE_EVENT = createTimelineEntryEvent('t', { type: 'Ping' }, blue);
  it('allows workflows INSIDE the embedded subtree to mutate it', async () => {
    const doc = loadYamlFromResources('processEmbedded_happy.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      TIMELINE_EVENT,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.emb.counter2).toBe(1);
    expect(jsonState.emb.salary2).toBe(1);
    expect(jsonState.counter).toBe(0);
    expect(jsonState.salary).toBe(0);
  });

  it('blocks a workflow OUTSIDE the subtree from writing inside', async () => {
    const doc = loadYamlFromResources('processEmbedded_block.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    await expect(
      documentProcessor.processEvents(initializedState, [TIMELINE_EVENT])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });

  it('re-evaluates contracts added MID-FLUSH', async () => {
    const doc = loadYamlFromResources('processEmbedded_live.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    await expect(
      documentProcessor.processEvents(initializedState, [TIMELINE_EVENT])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });

  it('blocks cross-boundary with multiple contracts', async () => {
    const doc = loadYamlFromResources('processEmbedded_multiContracts.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    await expect(
      documentProcessor.processEvents(initializedState, [TIMELINE_EVENT])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });

  it('allows workflows under each of multiple paths', async () => {
    const doc = loadYamlFromResources('processEmbedded_multiPaths_happy.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      TIMELINE_EVENT,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.embA.x).toBe(1);
    expect(jsonState.embB.y).toBe(1);
  });

  it('blocks root workflow touching any defined path', async () => {
    const doc = loadYamlFromResources('processEmbedded_multiPaths_block.yaml');

    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    await expect(
      documentProcessor.processEvents(initializedState, [TIMELINE_EVENT])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });
});
