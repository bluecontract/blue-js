import {
  SequentialWorkflowSchema,
  TimelineChannelSchema,
  TriggerEventSchema,
  UpdateDocumentSchema,
  JavaScriptCodeSchema,
} from '../repo/core';
import { Blue, TypeSchemaResolver } from '@blue-labs/language';
import fs from 'fs/promises';
import path from 'path';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';

describe('basic', () => {
  it('should work', async () => {
    const pathToDoc = path.join(__dirname, 'resources', 'doc.yaml');
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
    const documentProcessor = new BlueDocumentProcessor(blue);

    const document = await blue.yamlToNodeAsync(doc);

    const result = await documentProcessor.processEvents(document, [
      {
        type: 'Timeline Entry',
        timelineId: 'user-123',
        message: { type: 'Ping' },
      },
    ]);

    expect(result.state.get('/counter')?.toString()).toBe('3');
    expect(result.emitted).toHaveLength(3);
  });
});
