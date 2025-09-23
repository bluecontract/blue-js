import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../../BlueDocumentProcessor';
import {
  blueIds as coreBlueIds,
  repository as coreRepository,
} from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { prepareToProcess } from '../../testUtils';

function loadYamlFromResources(filename: string): Record<string, any> {
  const resourcePath = path.join(
    __dirname,
    '../../__tests__/resources',
    filename
  );
  const yamlContent = fs.readFileSync(resourcePath, 'utf8');
  return yaml.load(yamlContent) as Record<string, any>;
}

describe('Document Session Bootstrap integration', () => {
  const blue = new Blue({ repositories: [coreRepository, myosRepository] });
  const processor = new BlueDocumentProcessor(blue);

  it('handles Document Processing Initiated and initializes status', async () => {
    const doc = loadYamlFromResources('document-session-bootstrap.yaml');
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor: processor,
    });
    const json = blue.nodeToJson(initializedState, 'simple') as any;
    expect(json.bootstrapStatus.type.blueId).toEqual(
      coreBlueIds['Status In Progress']
    );
  });

  it('handles Participant Resolved and updates state + status', async () => {
    const doc = loadYamlFromResources('document-session-bootstrap.yaml');
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor: processor,
    });

    const participantResolved = blue.jsonValueToNode({
      type: 'MyOS Timeline Entry',
      timeline: { timelineId: 'admin-timeline' },
      message: {
        type: 'Operation Request',
        operation: 'myOsAdminUpdate',
        request: [
          {
            type: 'Participant Resolved',
            channelName: 'alice',
            participant: { status: { accountStatus: 'Active' } },
          },
        ],
      },
    });

    const { state } = await processor.processEvents(initializedState, [
      participantResolved,
    ]);
    const json = blue.nodeToJson(state, 'simple') as any;

    expect(json.participantsState?.alice?.accountStatus).toBe('Active');
    // Status should be updated from pending to in-progress
    expect(json.bootstrapStatus.type.blueId).toEqual(
      coreBlueIds['Status In Progress']
    );
  });

  it('handles Target Document Session Started and completes status', async () => {
    const doc = loadYamlFromResources('document-session-bootstrap.yaml');
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor: processor,
    });

    const sessionStarted = blue.jsonValueToNode({
      type: 'MyOS Timeline Entry',
      timeline: { timelineId: 'admin-timeline' },
      message: {
        type: 'Operation Request',
        operation: 'myOsAdminUpdate',
        request: [
          {
            type: 'Target Document Session Started',
            initiatorSessionId: 'sess-123',
          },
        ],
      },
    });

    const { state } = await processor.processEvents(initializedState, [
      sessionStarted,
    ]);
    const json = blue.nodeToJson(state, 'simple') as any;

    expect(json.initiatorSessionId).toBe('sess-123');
    expect(json.bootstrapStatus.type.blueId).toEqual(
      coreBlueIds['Status Completed']
    );
  });

  it('handles Bootstrap Failed and sets error + failed status', async () => {
    const doc = loadYamlFromResources('document-session-bootstrap.yaml');
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor: processor,
    });

    const failed = blue.jsonValueToNode({
      type: 'MyOS Timeline Entry',
      timeline: { timelineId: 'admin-timeline' },
      message: {
        type: 'Operation Request',
        operation: 'myOsAdminUpdate',
        request: [{ type: 'Bootstrap Failed', reason: 'Something went wrong' }],
      },
    });

    const { state } = await processor.processEvents(initializedState, [failed]);
    const json = blue.nodeToJson(state, 'simple') as any;

    expect(json.bootstrapError).toBe('Something went wrong');
    expect(json.bootstrapStatus.type.blueId).toEqual(
      coreBlueIds['Status Failed']
    );
  });
});
