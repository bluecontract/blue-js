import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { EmbeddedDocumentModificationError } from '../utils/exceptions';
import { Blue } from '../../Blue';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  return yaml.load(fs.readFileSync(resourcePath, 'utf8')) as any;
}

const EVT1 = {
  type: 'Timeline Entry',
  timelineId: 't1',
  message: { type: 'Ping' },
};
const EVT2 = {
  type: 'Timeline Entry',
  timelineId: 't2',
  message: { type: 'Remove' },
};
const EVT3 = {
  type: 'Timeline Entry',
  timelineId: 't3',
  message: { type: 'ReAdd' },
};

describe('Process Embedded – full dynamic cycle (t1→t2→t1→t3→t1)', () => {
  const doc = loadYamlFromResources('processEmbedded_dynamic_full.yaml');
  const blue = new Blue();
  const docNode = blue.jsonValueToNode(doc);

  it('1) initial t1 is blocked', async () => {
    await expect(blue.process(docNode, [EVT1])).rejects.toThrow(
      EmbeddedDocumentModificationError
    );
  });

  it('2) after t2 removal, t1 works', async () => {
    const { state } = await blue.process(docNode, [EVT2, EVT1]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.emb.counter2).toBe(1);
  });

  it('3) after t3 re-add, t1 is blocked again', async () => {
    const { state } = await blue.process(docNode, [EVT2, EVT1, EVT3]);

    await expect(blue.process(state, [EVT1])).rejects.toThrow(
      EmbeddedDocumentModificationError
    );
  });
});
