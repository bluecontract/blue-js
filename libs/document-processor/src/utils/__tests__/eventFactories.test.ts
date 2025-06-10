import { describe, it, expect } from 'vitest';
import {
  createDocumentUpdateEvent,
  createTimelineEntryEvent,
} from '../eventFactories';

describe('Event Factories', () => {
  describe('createDocumentUpdateEvent', () => {
    it('creates document update events correctly', () => {
      expect(
        createDocumentUpdateEvent({ op: 'replace', path: '/counter', val: 42 })
      ).toEqual({
        type: 'Document Update',
        op: 'replace',
        path: '/counter',
        val: 42,
      });

      expect(createDocumentUpdateEvent({ op: 'remove', path: '/old' })).toEqual(
        { type: 'Document Update', op: 'remove', path: '/old' }
      );

      expect(
        createDocumentUpdateEvent({ op: 'move', from: '/src', path: '/dest' })
      ).toEqual({
        type: 'Document Update',
        op: 'move',
        from: '/src',
        path: '/dest',
      });
    });

    it('validates required fields', () => {
      expect(() =>
        createDocumentUpdateEvent({ op: 'move', path: '/dest' } as any)
      ).toThrow("move operation requires 'from' path");

      expect(() =>
        createDocumentUpdateEvent({ op: 'add', path: '/new' } as any)
      ).toThrow("add operation requires 'val' property");
    });
  });

  describe('createTimelineEntryEvent', () => {
    it('creates timeline events correctly', () => {
      const event = createTimelineEntryEvent('user-123', { action: 'login' });

      expect(event).toEqual({
        type: 'Timeline Entry',
        timeline: { timelineId: 'user-123' },
        message: { action: 'login' },
      });
    });
  });
});
