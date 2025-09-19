/**
 * High-level checkpoint behaviour tests
 *
 *   – root-only channels
 *   – embedded docs via Process Embedded
 *   – multiple channels touched by one external event
 *   – skip internal-only batches
 *   – rollback on handler failure
 */
import { vi, describe, expect, beforeEach, test } from 'vitest';
import { Blue, ResolvedBlueNode } from '@blue-labs/language';
import { ContractProcessor, ContractRole, EventNodePayload } from '../types';
import { JsonObject } from 'type-fest';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

let seq = 0;

/* ------------------------------------------------------------------ */
/* Test fixtures                                                      */
/* ------------------------------------------------------------------ */
const blue = new Blue({
  repositories: [coreRepository],
});

const updatePayload: EventNodePayload = createTimelineEntryEvent(
  'profile-timeline',
  null,
  blue
);

const baseDoc: JsonObject = {
  contracts: {
    nameUpdates: { type: 'Timeline Channel', timelineId: 'profile-timeline' },
  },
};

const embeddedDoc: JsonObject = {
  ...baseDoc,
  contracts: {
    ...(baseDoc.contracts as JsonObject),
    embedder: { type: 'Process Embedded', paths: ['/child'] },
  },
  child: {
    contracts: {
      titleUpdates: { type: 'Timeline Channel', timelineId: 'child-timeline' },
    },
  },
};

describe('Checkpoint', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  beforeEach(() => {
    seq = 0;
    vi.spyOn(blue, 'calculateBlueId').mockImplementation(async () => {
      seq++;
      return `blue-${seq}`;
    });
  });

  /* ------------------------------------------------------------------ */
  /* 1 – root-level happy path                                          */
  /* ------------------------------------------------------------------ */
  test('root channel checkpoint is written once per external event', async () => {
    const { initializedState } = await prepareToProcess(baseDoc, {
      blue,
      documentProcessor,
    });
    const { state } = await documentProcessor.processEvents(initializedState, [
      updatePayload,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const id = jsonState.contracts.checkpoint.lastEvents.nameUpdates.blueId;
    expect(id).toBe('blue-1');

    // run same payload again – blue-id advances
    const res2 = await documentProcessor.processEvents(state, [updatePayload]);
    const jsonState2 = blue.nodeToJson(res2.state, 'simple') as any;
    const id2 = jsonState2.contracts.checkpoint.lastEvents.nameUpdates.blueId;

    expect(id2).toBe('blue-2');
  });

  /* ------------------------------------------------------------------ */
  /* 2 – root + embedded at once                                        */
  /* ------------------------------------------------------------------ */
  test('one external event updates in embedded docs', async () => {
    const payload = createTimelineEntryEvent('child-timeline', null, blue);

    const { initializedState } = await prepareToProcess(embeddedDoc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      payload,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const childId =
      jsonState.child.contracts.checkpoint.lastEvents.titleUpdates.blueId;

    expect(childId).toBe('blue-1');
  });

  /* ------------------------------------------------------------------ */
  /* 3 – multiple first-hop channels                                    */
  /* ------------------------------------------------------------------ */
  test('same blue-id is written for every channel touched by one payload', async () => {
    const complexDoc: JsonObject = {
      contracts: {
        chA: { type: 'Timeline Channel', timelineId: 'A' },
        chB: { type: 'Timeline Channel', timelineId: 'B' },
      },
    };

    const payloadA = createTimelineEntryEvent('A', null, blue);
    const payloadB = createTimelineEntryEvent('B', null, blue);

    const { initializedState } = await prepareToProcess(complexDoc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      payloadA,
      payloadB,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const idA = jsonState.contracts.checkpoint.lastEvents.chA.blueId;
    const idB = jsonState.contracts.checkpoint.lastEvents.chB.blueId;

    expect(idA).toBe('blue-1');
    expect(idB).toBe('blue-2'); // two externals in same batch, two ids
  });

  /* ------------------------------------------------------------------ */
  /* 4 – internal-only batch does NOT move checkpoint                    */
  /* ------------------------------------------------------------------ */
  test.todo('internal events leave checkpoint unchanged', async () => {
    // TODO: Implement
  });

  /* ------------------------------------------------------------------ */
  /* 5 – if any handler throws, nothing is written                       */
  /* ------------------------------------------------------------------ */
  class FailingProc implements ContractProcessor {
    contractType = 'Timeline Channel';
    contractBlueId = coreRepository.blueIds['Timeline Channel'];
    role: ContractRole = 'adapter';
    supports() {
      return true;
    }
    handle() {
      throw new Error('boom');
    }
  }

  test('checkpoint write is rolled back when a handler errors', async () => {
    const engine = new BlueDocumentProcessor(blue, [new FailingProc()]);

    const { initializedState } = await prepareToProcess(baseDoc, {
      blue,
      documentProcessor,
    });

    await expect(
      engine.processEvents(initializedState, [updatePayload])
    ).rejects.toThrow('boom');

    // second run with no events – state should still contain *no* blueId
    const { state } = await engine.processEvents(initializedState, []);
    const jsonState = blue.nodeToJson(state, 'simple') as any;
    expect(
      jsonState.contracts.checkpoint.lastEvents.nameUpdates
    ).toBeUndefined();
  });
});

describe('Checkpoint - ResolvedBlueNode handling', () => {
  const baseDoc: JsonObject = {
    contracts: {
      timelineChannel: { type: 'Timeline Channel', timelineId: 'Alice' },
    },
  };

  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  /* ------------------------------------------------------------------ */
  /* 6 – ResolvedBlueNode handling                                      */
  /* ------------------------------------------------------------------ */
  test('checkpoint uses minimal node for ResolvedBlueNode event blueId calculation', async () => {
    // Create a base node with merge to simulate inherited properties
    const baseNode = blue.jsonValueToNode({
      type: 'Timeline Entry',
      message: {
        type: 'Chat Message',
        message: 'Hello, world!',
      },
      timeline: {
        timelineId: 'Alice',
      },
    });

    const resolvedPayload = blue.resolve(baseNode);
    expect(resolvedPayload).toBeInstanceOf(ResolvedBlueNode);

    const { initializedState } = await prepareToProcess(baseDoc, {
      blue,
      documentProcessor,
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      resolvedPayload,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const checkpointId =
      jsonState.contracts.checkpoint.lastEvents.timelineChannel.blueId;

    expect(checkpointId).not.toBe(blue.calculateBlueIdSync(resolvedPayload));
    expect(checkpointId).toBe(blue.calculateBlueIdSync(baseNode));
  });
});
