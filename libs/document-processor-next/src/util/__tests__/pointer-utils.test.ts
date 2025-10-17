/**
 * 1:1 port tests for {@code blue.language.processor.util.PointerUtils}.
 */
import { describe, expect, it } from 'vitest';

import {
  joinRelativePointers,
  normalizePointer,
  normalizeScope,
  relativizePointer,
  resolvePointer,
  stripSlashes,
} from '../pointer-utils.js';

describe('PointerUtils', () => {
  describe('normalizeScope', () => {
    it('normalizes null and empty scope to root', () => {
      expect(normalizeScope(null)).toBe('/');
      expect(normalizeScope('')).toBe('/');
    });

    it('keeps leading slash and adds one when missing', () => {
      expect(normalizeScope('/')).toBe('/');
      expect(normalizeScope('foo')).toBe('/foo');
      expect(normalizeScope('/foo')).toBe('/foo');
    });
  });

  describe('normalizePointer', () => {
    it('normalizes null and empty pointer to root', () => {
      expect(normalizePointer(null)).toBe('/');
      expect(normalizePointer('')).toBe('/');
    });

    it('ensures a single leading slash', () => {
      expect(normalizePointer('/')).toBe('/');
      expect(normalizePointer('foo')).toBe('/foo');
      expect(normalizePointer('/foo')).toBe('/foo');
    });
  });

  describe('stripSlashes', () => {
    it('returns empty string for null, empty, or whitespace input', () => {
      expect(stripSlashes(null)).toBe('');
      expect(stripSlashes('')).toBe('');
      expect(stripSlashes('   ')).toBe('');
    });

    it('strips leading and trailing slashes but keeps middle sections', () => {
      expect(stripSlashes('/a/b/')).toBe('a/b');
      expect(stripSlashes('///')).toBe('');
      expect(stripSlashes('a/b')).toBe('a/b');
    });
  });

  describe('joinRelativePointers', () => {
    it('joins segments using reserved rules', () => {
      expect(joinRelativePointers('', '')).toBe('/');
      expect(joinRelativePointers('', 'a')).toBe('/a');
      expect(joinRelativePointers('a', '')).toBe('/a');
      expect(joinRelativePointers('a', 'b')).toBe('/a/b');
      expect(joinRelativePointers('/a/', '/b/')).toBe('/a/b');
    });
  });

  describe('resolvePointer', () => {
    it('resolves scope and pointer combinations', () => {
      expect(resolvePointer('/', '/x')).toBe('/x');
      expect(resolvePointer('/a', '/')).toBe('/a');
      expect(resolvePointer('/a', '/b')).toBe('/a/b');
    });
  });

  describe('relativizePointer', () => {
    it('relativizes absolute pointers to the provided scope', () => {
      expect(relativizePointer('/', '/x')).toBe('/x');
      expect(relativizePointer('/a', '/a')).toBe('/');
      expect(relativizePointer('/a', '/a/b/c')).toBe('/b/c');
      expect(relativizePointer('/a', '/x')).toBe('/x');
      expect(relativizePointer('/a/b', '/a/b')).toBe('/');
    });
  });
});
