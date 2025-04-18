import { UrlContentFetcher, UrlFetchStrategy } from '../UrlContentFetcher';
import { BlueNode } from '../../model';

// Note: In a real environment, you would use jest.mock('axios')
// but we're avoiding that here due to linter issues

// Mock fetch strategy for testing
class MockFetchStrategy implements UrlFetchStrategy {
  public fetchCalled = false;
  public lastUrl = '';

  async fetchUrl(url: string): Promise<{ data: string; contentType: string }> {
    this.fetchCalled = true;
    this.lastUrl = url;
    return {
      data: '{"test": "mock data"}',
      contentType: 'application/json',
    };
  }

  reset() {
    this.fetchCalled = false;
    this.lastUrl = '';
  }
}

describe('UrlContentFetcher', () => {
  let fetcher: UrlContentFetcher;
  let mockStrategy: MockFetchStrategy;

  beforeEach(() => {
    mockStrategy = new MockFetchStrategy();
    fetcher = new UrlContentFetcher(mockStrategy);
    // Clear the cache before each test
    fetcher.clearCache();
  });

  test('should identify if a string is a URL', () => {
    expect(fetcher.canHandleUrl('https://example.com/blue.json')).toBe(true);
    expect(fetcher.canHandleUrl('http://localhost:8080/data.yaml')).toBe(true);
    expect(fetcher.canHandleUrl('not-a-url')).toBe(false);
    expect(fetcher.canHandleUrl('file:///path/to/file.json')).toBe(false); // file protocol is not supported
  });

  test('should return empty array for non-URL strings', () => {
    const result = fetcher.getFromCache('not-a-url');
    expect(result).toEqual([]);
  });

  test('should prefetch and return nodes for a URL', () => {
    const mockNode = new BlueNode().setValue('test');
    fetcher.prefetchUrl('https://example.com/data.json', [mockNode]);

    const result = fetcher.getFromCache('https://example.com/data.json');
    expect(result).toHaveLength(1);
    expect(result[0].getValue()).toBe('test');
  });

  test('should return empty array for URLs not in cache', () => {
    // Should return empty for URLs not in cache
    const result = fetcher.getFromCache('https://example.com/data.json');
    expect(result).toEqual([]);
  });

  test('should clear cache', () => {
    const mockNode = new BlueNode().setValue('test');
    fetcher.prefetchUrl('https://example.com/data.json', [mockNode]);

    // Cache should be populated
    expect(fetcher.getFromCache('https://example.com/data.json')).toHaveLength(
      1
    );

    // Clear cache
    fetcher.clearCache();

    // Cache should be empty
    expect(fetcher.getFromCache('https://example.com/data.json')).toEqual([]);
  });

  test('should use custom fetch strategy', async () => {
    mockStrategy.reset();
    const url = 'https://example.com/test.json';

    // Fetch from the URL
    await fetcher.fetchAndCache(url);

    // Verify the custom strategy was used
    expect(mockStrategy.fetchCalled).toBe(true);
    expect(mockStrategy.lastUrl).toBe(url);
  });

  test('should be able to change fetch strategy', async () => {
    const newMockStrategy = new MockFetchStrategy();
    fetcher.setFetchStrategy(newMockStrategy);

    const url = 'https://example.com/another-test.json';
    await fetcher.fetchAndCache(url);

    // Verify the new strategy was used
    expect(newMockStrategy.fetchCalled).toBe(true);
    expect(newMockStrategy.lastUrl).toBe(url);

    // Verify we can get the strategy reference
    expect(fetcher.getFetchStrategy()).toBe(newMockStrategy);
  });
});
