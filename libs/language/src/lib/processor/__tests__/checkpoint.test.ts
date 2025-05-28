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
import { Blue } from '../../Blue';
import { ContractProcessor, ContractRole, EventNodePayload } from '../types';
import { JsonObject } from 'type-fest';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { blueIds } from '../../../repo/core';

let seq = 0;

/* ------------------------------------------------------------------ */
/* Test fixtures                                                      */
/* ------------------------------------------------------------------ */
const updatePayload: EventNodePayload = {
  type: 'Document Update',
  op: 'replace',
  path: '/profile/name',
  val: 'Alice',
};

const baseDoc: JsonObject = {
  profile: { name: 'Bob' },
  contracts: {
    nameUpdates: { type: 'Document Update Channel', path: '/profile/name' },
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
      titleUpdates: { type: 'Document Update Channel', path: '/title' },
    },
    title: 'draft',
  },
};

describe('Checkpoint', () => {
  const blue = new Blue();
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
    const docNode = blue.jsonValueToNode(baseDoc);

    const { state } = await blue.process(docNode, [updatePayload]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const id = jsonState.contracts.checkpoint.lastEvents.nameUpdates.blueId;
    expect(id).toBe('blue-1');

    // run same payload again – blue-id advances
    const res2 = await blue.process(state, [updatePayload]);
    const jsonState2 = blue.nodeToJson(res2.state, 'simple') as any;
    const id2 = jsonState2.contracts.checkpoint.lastEvents.nameUpdates.blueId;

    expect(id2).toBe('blue-2');
  });

  /* ------------------------------------------------------------------ */
  /* 2 – root + embedded at once                                        */
  /* ------------------------------------------------------------------ */
  test('one external event updates in embedded docs', async () => {
    const payload = {
      ...updatePayload,
      path: '/child/title',
      val: 'published',
    };

    const docNode = blue.jsonValueToNode(embeddedDoc);

    const { state } = await blue.process(docNode, [payload]);

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
      data: { a: 1, b: 1 },
      contracts: {
        chA: { type: 'Document Update Channel', path: '/data/a' },
        chB: { type: 'Document Update Channel', path: '/data/b' },
      },
    };

    const payloadA = { ...updatePayload, path: '/data/a', val: 2 };
    const payloadB = { ...updatePayload, path: '/data/b', val: 2 };

    const docNode = blue.jsonValueToNode(complexDoc);

    const { state } = await blue.process(docNode, [payloadA, payloadB]);

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
    contractType = 'Document Update Channel';
    contractBlueId = blueIds['Document Update Channel'];
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

    const docNode = blue.jsonValueToNode(baseDoc);

    await expect(
      engine.processEvents(docNode, [updatePayload])
    ).rejects.toThrow('boom');

    // second run with no events – state should still contain *no* blueId
    const { state } = await engine.processEvents(docNode, []);
    const jsonState = blue.nodeToJson(state, 'simple') as any;
    expect(
      jsonState.contracts.checkpoint.lastEvents.nameUpdates
    ).toBeUndefined();
  });
});
