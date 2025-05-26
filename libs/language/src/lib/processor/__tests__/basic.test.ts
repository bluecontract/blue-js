import { TypeSchemaResolver } from '../..';
import {
  SequentialWorkflowSchema,
  TimelineChannelSchema,
  TriggerEventSchema,
  UpdateDocumentSchema,
} from '../../../repo/core';
import { JavaScriptCodeSchema } from '../../../repo/core/schema/JavaScriptCode';
import { Blue } from '../../Blue';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import fs from 'fs/promises';
import path from 'path';

describe('basic', () => {
  it('should work', async () => {
    const pathToDoc = path.join(__dirname, 'doc.yaml');
    const doc = await fs.readFile(pathToDoc, 'utf8');

    const typeSchemaResolver = new TypeSchemaResolver([
      TimelineChannelSchema,
      SequentialWorkflowSchema,
      TriggerEventSchema,
      UpdateDocumentSchema,
      JavaScriptCodeSchema,
    ]);
    const blue = new Blue({
      typeSchemaResolver,
    });
    const processor = new BlueDocumentProcessor(blue);
    const document = await blue.yamlToNodeAsync(doc);
    await processor.initialise(document);

    const result = await processor.processEvents(document, [
      {
        type: 'Timeline Entry',
        timeline: { timelineId: 'user-123' },
        message: { type: 'Ping' },
      },
    ]);

    expect(result.state.get('/counter')?.toString()).toBe('3');
    expect(result.emitted).toHaveLength(3);
  });
});
