import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { EmbeddedDocumentModificationError } from '../utils/exceptions';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  return yaml.load(fs.readFileSync(resourcePath, 'utf8')) as any;
}

const timelineEvent = (
  timelineId: string,
  message: unknown = { type: 'Ping' }
) => {
  return {
    type: 'Timeline Entry',
    timeline: { timelineId },
    message,
  };
};
const EVT1 = timelineEvent('t1');
const EVT2 = timelineEvent('t2', { type: 'Remove' });
const EVT3 = timelineEvent('t3', { type: 'ReAdd' });

describe('Process Embedded – full dynamic cycle (t1→t2→t1→t3→t1)', () => {
  const doc = loadYamlFromResources('processEmbedded_dynamic_full.yaml');
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  const docNode = blue.jsonValueToNode(doc);

  it('1) initial t1 is blocked', async () => {
    await expect(
      documentProcessor.processEvents(docNode, [EVT1])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });

  it('2) after t2 removal, t1 works', async () => {
    const { state } = await documentProcessor.processEvents(docNode, [
      EVT2,
      EVT1,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.emb.counter2).toBe(1);
  });

  it('3) after t3 re-add, t1 is blocked again', async () => {
    const { state } = await documentProcessor.processEvents(docNode, [
      EVT2,
      EVT1,
      EVT3,
    ]);

    await expect(
      documentProcessor.processEvents(state, [EVT1])
    ).rejects.toThrow(EmbeddedDocumentModificationError);
  });
});
