import { describe, it, expect } from 'vitest';
import {
  createDocumentUpdateEvent,
  createTimelineEntryEvent,
} from '../eventFactories';
import { Blue } from '@blue-labs/language';
import {
  repository as coreRepository,
  blueIds as coreBlueIds,
} from '@blue-repository/core-dev';

const blue = new Blue({
  repositories: [coreRepository],
});

describe('Event Factories', () => {
  describe('createDocumentUpdateEvent', () => {
    it('creates document update events correctly', () => {
      const eventNode = createDocumentUpdateEvent(
        { op: 'replace', path: '/counter', val: 42 },
        blue,
      );

      const expectedType = {
        blueId: coreBlueIds['Document Update'],
      };

      expect(blue.nodeToJson(eventNode, 'original')).toMatchObject({
        type: expectedType,
        op: 'replace',
        path: '/counter',
        val: 42,
      });

      const eventNode2 = createDocumentUpdateEvent(
        { op: 'remove', path: '/old' },
        blue,
      );
      expect(blue.nodeToJson(eventNode2, 'original')).toMatchObject({
        type: expectedType,
        op: 'remove',
        path: '/old',
      });

      const eventNode3 = createDocumentUpdateEvent(
        { op: 'move', from: '/src', path: '/dest' },
        blue,
      );
      expect(blue.nodeToJson(eventNode3, 'original')).toMatchObject({
        type: expectedType,
        op: 'move',
        from: '/src',
        path: '/dest',
      });
    });

    it('validates required fields', () => {
      expect(() =>
        createDocumentUpdateEvent({ op: 'move', path: '/dest' } as any, blue),
      ).toThrow("move operation requires 'from' path");

      expect(() =>
        createDocumentUpdateEvent({ op: 'add', path: '/new' } as any, blue),
      ).toThrow("add operation requires 'val' property");
    });
  });

  describe('createTimelineEntryEvent', () => {
    it('creates timeline events correctly', () => {
      const event = createTimelineEntryEvent(
        'user-123',
        { action: 'login' },
        blue,
      );

      expect(blue.nodeToJson(event, 'original')).toEqual({
        type: {
          blueId: coreBlueIds['Timeline Entry'],
        },
        timeline: { timelineId: 'user-123' },
        message: { action: 'login' },
      });
    });
  });
});
