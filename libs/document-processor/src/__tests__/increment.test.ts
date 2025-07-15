import { describe, it } from 'vitest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { prepareToProcess } from '../testUtils';
import { createMyOSTimelineEntryEvent } from '../utils/eventFactories';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(__dirname, 'resources', filename);
  return yaml.load(fs.readFileSync(resourcePath, 'utf8')) as any;
}

describe('increment', () => {
  const doc = loadYamlFromResources('increment.yaml');
  const blue = new Blue({
    repositories: [coreRepository, myosRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  it('should increment the number', async () => {
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });

    const incrementEvent = createMyOSTimelineEntryEvent(
      'owner-timeline',
      {
        type: 'Operation Request',
        operation: 'increment',
        request: 4,
      },
      blue
    );

    const { state } = await documentProcessor.processEvents(initializedState, [
      incrementEvent,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;
    expect(jsonState.counter).toBe(4);
  });
});
