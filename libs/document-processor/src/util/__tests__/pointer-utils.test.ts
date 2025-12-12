import {
  joinRelativePointers,
  normalizePointer,
  normalizeScope,
  relativizePointer,
  resolvePointer,
  stripSlashes,
} from '../pointer-utils.js';

describe('pointer-utils', () => {
  describe('normalizeScope', () => {
    it('normalizes null or empty scope to root', () => {
      expect(normalizeScope(null)).toBe('/');
      expect(normalizeScope('')).toBe('/');
    });

    it('ensures a leading slash for scope paths', () => {
      expect(normalizeScope('foo')).toBe('/foo');
      expect(normalizeScope('/foo')).toBe('/foo');
    });
  });

  describe('normalizePointer', () => {
    it('normalizes null or empty pointers to root', () => {
      expect(normalizePointer(null)).toBe('/');
      expect(normalizePointer('')).toBe('/');
    });

    it('ensures a leading slash for pointers', () => {
      expect(normalizePointer('foo/bar')).toBe('/foo/bar');
      expect(normalizePointer('/foo')).toBe('/foo');
    });
  });

  describe('stripSlashes', () => {
    it('strips leading and trailing slashes with whitespace trimmed', () => {
      expect(stripSlashes(' /foo/bar/ ')).toBe('foo/bar');
      expect(stripSlashes('///foo///bar///')).toBe('foo///bar');
      expect(stripSlashes('///foo///')).toBe('foo');
    });

    it('returns empty string for nullish or blank input', () => {
      expect(stripSlashes(null)).toBe('');
      expect(stripSlashes('   ')).toBe('');
    });
  });

  describe('joinRelativePointers', () => {
    it('joins two relative pointers', () => {
      expect(joinRelativePointers('foo', 'bar')).toBe('/foo/bar');
    });

    it('handles empty base', () => {
      expect(joinRelativePointers('', 'bar')).toBe('/bar');
    });

    it('handles empty tail', () => {
      expect(joinRelativePointers('foo', '')).toBe('/foo');
    });

    it('returns root when both empty', () => {
      expect(joinRelativePointers('', '')).toBe('/');
    });
  });

  describe('resolvePointer', () => {
    it('resolves relative pointer within scope', () => {
      expect(resolvePointer('/scope', '/child')).toBe('/scope/child');
    });

    it('resolves at root scope', () => {
      expect(resolvePointer('/', '/child')).toBe('/child');
    });

    it('resolves for pointer root', () => {
      expect(resolvePointer('/scope', '/')).toBe('/scope');
    });
  });

  describe('relativizePointer', () => {
    it('relativizes pointer within scope', () => {
      expect(relativizePointer('/scope', '/scope/child')).toBe('/child');
    });

    it('returns root when absolute equals scope', () => {
      expect(relativizePointer('/scope', '/scope')).toBe('/');
    });

    it('returns original when outside scope', () => {
      expect(relativizePointer('/scope', '/other')).toBe('/other');
    });

    it('returns absolute when scope is root', () => {
      expect(relativizePointer('/', '/child')).toBe('/child');
    });
  });
});
