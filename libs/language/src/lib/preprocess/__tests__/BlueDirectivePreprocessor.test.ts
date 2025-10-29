import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlueNode } from '../../model';
import { BlueDirectivePreprocessor } from '../BlueDirectivePreprocessor';
import {
  UrlContentFetcher,
  UrlFetchStrategy,
} from '../../provider/UrlContentFetcher';
import { BlueIds } from '../../utils/BlueIds';

// Mock UrlFetchStrategy for testing
class MockUrlFetchStrategy implements UrlFetchStrategy {
  public fetchCalled = false;
  public lastUrl = '';
  public mockResponse: { data: string; contentType: string };

  constructor(
    mockResponse: { data: string; contentType: string } = {
      data: '{"value": "mock data"}',
      contentType: 'application/json',
    },
  ) {
    this.mockResponse = mockResponse;
  }

  async fetchUrl(url: string): Promise<{ data: string; contentType: string }> {
    this.fetchCalled = true;
    this.lastUrl = url;
    return this.mockResponse;
  }

  reset(): void {
    this.fetchCalled = false;
    this.lastUrl = '';
  }
}

describe('BlueDirectivePreprocessor', () => {
  let preprocessor: BlueDirectivePreprocessor;
  let mockUrlFetchStrategy: MockUrlFetchStrategy;
  let urlContentFetcher: UrlContentFetcher;

  beforeEach(() => {
    mockUrlFetchStrategy = new MockUrlFetchStrategy();
    urlContentFetcher = new UrlContentFetcher(mockUrlFetchStrategy);
    preprocessor = new BlueDirectivePreprocessor(new Map(), urlContentFetcher);
  });

  describe('process', () => {
    it('should return the same node if there is no blue value', () => {
      const node = new BlueNode().setValue('test');
      const result = preprocessor.process(node);
      expect(result).toBe(node);
    });

    it('should handle alias values', () => {
      const aliases = new Map<string, string>();
      aliases.set('alias1', 'blueId1');
      preprocessor = new BlueDirectivePreprocessor(aliases);

      const node = new BlueNode().setBlue(new BlueNode().setValue('alias1'));
      const result = preprocessor.process(node);

      expect(result).not.toBe(node); // Should be a clone, not the same instance
      expect(result.getBlue()?.getBlueId()).toBe('blueId1');
    });

    it('should handle BlueId values', () => {
      // Mock BlueIds.isPotentialBlueId to return true
      const spy = vi.spyOn(BlueIds, 'isPotentialBlueId').mockReturnValue(true);

      const blueId = 'validBlueId';
      const node = new BlueNode().setBlue(new BlueNode().setValue(blueId));
      const result = preprocessor.process(node);

      expect(result).not.toBe(node); // Should be a clone
      expect(result.getBlue()?.getBlueId()).toBe(blueId);

      spy.mockRestore();
    });

    it('should throw an error for URL values', () => {
      const node = new BlueNode().setBlue(
        new BlueNode().setValue('https://example.com/data.json'),
      );

      expect(() => preprocessor.process(node)).toThrow(
        "URL 'https://example.com/data.json' detected. Use the async version of this method to fetch the content.",
      );
    });

    it('should throw an error for invalid blue values', () => {
      // Mock BlueIds.isPotentialBlueId to return false
      const spy = vi.spyOn(BlueIds, 'isPotentialBlueId').mockReturnValue(false);

      const node = new BlueNode().setBlue(new BlueNode().setValue('invalid'));

      expect(() => preprocessor.process(node)).toThrow(
        'Invalid blue value: invalid',
      );

      spy.mockRestore();
    });
  });

  describe('processAsync', () => {
    it('should return the same node if there is no blue value', async () => {
      const node = new BlueNode().setValue('test');
      const result = await preprocessor.processAsync(node);
      expect(result).toBe(node);
    });

    it('should handle alias values asynchronously', async () => {
      const aliases = new Map<string, string>();
      aliases.set('alias1', 'blueId1');
      preprocessor = new BlueDirectivePreprocessor(aliases);

      const node = new BlueNode().setBlue(new BlueNode().setValue('alias1'));
      const result = await preprocessor.processAsync(node);

      expect(result).not.toBe(node); // Should be a clone, not the same instance
      expect(result.getBlue()?.getBlueId()).toBe('blueId1');
    });

    it('should handle BlueId values asynchronously', async () => {
      // Mock BlueIds.isPotentialBlueId to return true
      const spy = vi.spyOn(BlueIds, 'isPotentialBlueId').mockReturnValue(true);

      const blueId = 'validBlueId';
      const node = new BlueNode().setBlue(new BlueNode().setValue(blueId));
      const result = await preprocessor.processAsync(node);

      expect(result).not.toBe(node); // Should be a clone
      expect(result.getBlue()?.getBlueId()).toBe(blueId);

      spy.mockRestore();
    });

    it('should throw error for URL fetching when fetching is disabled (default)', async () => {
      const mockFetchStrategy = new MockUrlFetchStrategy();
      const fetcher = new UrlContentFetcher(mockFetchStrategy);
      preprocessor = new BlueDirectivePreprocessor(new Map(), fetcher);

      const url = 'https://example.com/data.json';
      const node = new BlueNode().setBlue(new BlueNode().setValue(url));

      await expect(preprocessor.processAsync(node)).rejects.toThrow(
        'URL fetching is disabled. Enable it using the enableFetching method.',
      );

      expect(mockFetchStrategy.fetchCalled).toBe(false);
    });

    it('should fetch content from URL when fetching is enabled', async () => {
      const mockFetchStrategy = new MockUrlFetchStrategy({
        data: JSON.stringify({ value: 'test data' }),
        contentType: 'application/json',
      });
      const fetcher = new UrlContentFetcher(mockFetchStrategy);
      fetcher.enableFetching();
      preprocessor = new BlueDirectivePreprocessor(new Map(), fetcher);

      const url = 'https://example.com/data.json';
      const node = new BlueNode().setBlue(new BlueNode().setValue(url));
      const result = await preprocessor.processAsync(node);

      expect(mockFetchStrategy.fetchCalled).toBe(true);
      expect(mockFetchStrategy.lastUrl).toBe(url);
      expect(result).not.toBe(node); // Should be a clone
      expect(result.getBlue()?.getItems()).toBeDefined();
    });

    it('should throw an error if URL is provided but no fetcher is set', async () => {
      preprocessor = new BlueDirectivePreprocessor();

      const url = 'https://example.com/data.json';
      const node = new BlueNode().setBlue(new BlueNode().setValue(url));

      await expect(preprocessor.processAsync(node)).rejects.toThrow(
        `UrlContentFetcher not provided for URL: ${url}`,
      );
    });

    it('should throw an error for invalid blue values asynchronously', async () => {
      // Mock BlueIds.isPotentialBlueId to return false
      const spy = vi.spyOn(BlueIds, 'isPotentialBlueId').mockReturnValue(false);

      const node = new BlueNode().setBlue(new BlueNode().setValue('invalid'));

      await expect(preprocessor.processAsync(node)).rejects.toThrow(
        'Invalid blue value: invalid',
      );

      spy.mockRestore();
    });

    it('should handle null blue values correctly', async () => {
      const node = new BlueNode();
      const result = await preprocessor.processAsync(node);
      expect(result).toBe(node);
    });

    it('should handle non-string blue values correctly', async () => {
      const node = new BlueNode().setBlue(new BlueNode().setValue(123));
      const result = await preprocessor.processAsync(node);
      expect(result).toBe(node);
    });
  });

  describe('getters and setters', () => {
    it('should get and set preprocessing aliases', () => {
      const aliases = new Map<string, string>();
      aliases.set('alias1', 'blueId1');
      aliases.set('alias2', 'blueId2');

      preprocessor.setPreprocessingAliases(aliases);
      const retrievedAliases = preprocessor.getPreprocessingAliases();

      expect(retrievedAliases.size).toBe(2);
      expect(retrievedAliases.get('alias1')).toBe('blueId1');
      expect(retrievedAliases.get('alias2')).toBe('blueId2');

      // Check that it's a copy, not the same reference
      aliases.set('alias3', 'blueId3');
      expect(preprocessor.getPreprocessingAliases().has('alias3')).toBe(false);
    });

    it('should add preprocessing aliases', () => {
      const initialAliases = new Map<string, string>();
      initialAliases.set('alias1', 'blueId1');
      preprocessor = new BlueDirectivePreprocessor(initialAliases);

      const additionalAliases = new Map<string, string>();
      additionalAliases.set('alias2', 'blueId2');
      additionalAliases.set('alias3', 'blueId3');

      preprocessor.addPreprocessingAliases(additionalAliases);
      const retrievedAliases = preprocessor.getPreprocessingAliases();

      expect(retrievedAliases.size).toBe(3);
      expect(retrievedAliases.get('alias1')).toBe('blueId1');
      expect(retrievedAliases.get('alias2')).toBe('blueId2');
      expect(retrievedAliases.get('alias3')).toBe('blueId3');
    });

    it('should get and set URL content fetcher', () => {
      const newFetcher = new UrlContentFetcher();

      // Initially fetcher should be what we set in beforeEach
      expect(preprocessor.getUrlContentFetcher()).toBe(urlContentFetcher);

      // Set a new fetcher
      preprocessor.setUrlContentFetcher(newFetcher);

      // Should return the new fetcher
      expect(preprocessor.getUrlContentFetcher()).toBe(newFetcher);
    });
  });
});
