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

  test('should validate URL strings', () => {
    expect(() =>
      fetcher.validateUrl('https://example.com/blue.json'),
    ).not.toThrow();
    expect(() =>
      fetcher.validateUrl('http://localhost:8080/data.yaml'),
    ).not.toThrow();
    expect(() => fetcher.validateUrl('not-a-url')).toThrow('Invalid URL');
    expect(() => fetcher.validateUrl('file:///path/to/file.json')).toThrow(
      'Invalid URL',
    ); // file protocol is not supported
  });

  test('should return empty array for non-URL strings in getFromCache', () => {
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

  test('should silently ignore invalid URLs in prefetchUrl', () => {
    const mockNode = new BlueNode().setValue('test');
    expect(() => fetcher.prefetchUrl('not-a-url', [mockNode])).not.toThrow();
    // Cache should not be updated
    expect(fetcher.getFromCache('not-a-url')).toEqual([]);
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
      1,
    );

    // Clear cache
    fetcher.clearCache();

    // Cache should be empty
    expect(fetcher.getFromCache('https://example.com/data.json')).toEqual([]);
  });

  test('should use custom fetch strategy', async () => {
    mockStrategy.reset();
    fetcher.enableFetching();
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
    fetcher.enableFetching();

    const url = 'https://example.com/another-test.json';
    await fetcher.fetchAndCache(url);

    // Verify the new strategy was used
    expect(newMockStrategy.fetchCalled).toBe(true);
    expect(newMockStrategy.lastUrl).toBe(url);

    // Verify we can get the strategy reference
    expect(fetcher.getFetchStrategy()).toBe(newMockStrategy);
  });

  test('should enable and disable fetching', () => {
    expect(fetcher.isFetchingEnabled()).toBe(false);

    fetcher.enableFetching();
    expect(fetcher.isFetchingEnabled()).toBe(true);
    // Enabling fetching should clear domain restrictions
    expect(fetcher.getAllowedDomains()).toEqual([]);

    fetcher.disableFetching();
    expect(fetcher.isFetchingEnabled()).toBe(false);
  });

  test('should throw error when trying to fetch with fetching disabled', async () => {
    const url = 'https://example.com/test.json';

    await expect(fetcher.fetchAndCache(url)).rejects.toThrow(
      'URL fetching is disabled',
    );

    // Verify the strategy was not called
    expect(mockStrategy.fetchCalled).toBe(false);
  });

  test('should throw error for invalid URLs in fetchAndCache', async () => {
    fetcher.enableFetching();
    await expect(fetcher.fetchAndCache('not-a-url')).rejects.toThrow(
      'Invalid URL',
    );
    expect(mockStrategy.fetchCalled).toBe(false);
  });

  describe('Domain-specific URL fetching', () => {
    beforeEach(() => {
      mockStrategy.reset();
      fetcher.enableFetching();
    });

    test('should allow all domains by default when fetching is enabled', async () => {
      expect(fetcher.getAllowedDomains()).toEqual([]);
      expect(fetcher.isDomainAllowed('https://example.com/test.json')).toBe(
        true,
      );
      expect(
        fetcher.isDomainAllowed('https://random-domain.com/test.json'),
      ).toBe(true);
    });

    test('should restrict fetching to specific domains when specified', async () => {
      fetcher.enableFetchingForDomains(['example.com', 'api.github.com']);

      expect(fetcher.isDomainAllowed('https://example.com/test.json')).toBe(
        true,
      );
      expect(fetcher.isDomainAllowed('https://api.github.com/data.json')).toBe(
        true,
      );
      expect(
        fetcher.isDomainAllowed('https://subdomain.example.com/test.json'),
      ).toBe(true);
      expect(
        fetcher.isDomainAllowed('https://random-domain.com/test.json'),
      ).toBe(false);
    });

    test('should add and remove domains from the allowed list', () => {
      // Start with an empty allowed domains list
      expect(fetcher.getAllowedDomains()).toEqual([]);

      // Add a domain
      fetcher.allowDomain('example.com');
      expect(fetcher.getAllowedDomains()).toEqual(['example.com']);

      // Add another domain
      fetcher.allowDomain('api.github.com');
      expect(fetcher.getAllowedDomains()).toContain('example.com');
      expect(fetcher.getAllowedDomains()).toContain('api.github.com');

      // Try adding the same domain again (should not duplicate)
      fetcher.allowDomain('example.com');
      expect(fetcher.getAllowedDomains().length).toBe(2);

      // Remove a domain
      fetcher.disallowDomain('example.com');
      expect(fetcher.getAllowedDomains()).toEqual(['api.github.com']);

      // Clear all domains
      fetcher.clearAllowedDomains();
      expect(fetcher.getAllowedDomains()).toEqual([]);
    });

    test('should handle subdomains correctly', () => {
      fetcher.enableFetchingForDomains(['example.com']);

      // Main domain should be allowed
      expect(fetcher.isDomainAllowed('https://example.com/test.json')).toBe(
        true,
      );

      // Subdomains should be allowed
      expect(fetcher.isDomainAllowed('https://api.example.com/test.json')).toBe(
        true,
      );
      expect(
        fetcher.isDomainAllowed('https://subdomain.example.com/test.json'),
      ).toBe(true);

      // Other domains should not be allowed
      expect(fetcher.isDomainAllowed('https://example.org/test.json')).toBe(
        false,
      );
      expect(fetcher.isDomainAllowed('https://examplefake.com/test.json')).toBe(
        false,
      );
    });

    test('should throw error when trying to fetch from non-allowed domain', async () => {
      fetcher.enableFetchingForDomains(['example.com']);

      // This should work
      await fetcher.fetchAndCache('https://example.com/test.json');
      expect(mockStrategy.fetchCalled).toBe(true);
      mockStrategy.reset();

      // This should fail
      const restrictedUrl = 'https://restricted.com/test.json';
      await expect(fetcher.fetchAndCache(restrictedUrl)).rejects.toThrow(
        `Domain not allowed for URL: ${restrictedUrl}`,
      );
      expect(mockStrategy.fetchCalled).toBe(false);
    });

    test('should clear domain restrictions when enableFetching is called', () => {
      // Set up domain restrictions
      fetcher.enableFetchingForDomains(['example.com']);
      expect(fetcher.getAllowedDomains()).toEqual(['example.com']);

      // Call enableFetching which should clear restrictions
      fetcher.enableFetching();
      expect(fetcher.getAllowedDomains()).toEqual([]);
      expect(
        fetcher.isDomainAllowed('https://random-domain.com/test.json'),
      ).toBe(true);
    });

    test('should handle invalid URLs gracefully in isDomainAllowed', () => {
      fetcher.enableFetchingForDomains(['example.com']);

      // Invalid URLs should not be allowed
      expect(fetcher.isDomainAllowed('not-a-url')).toBe(false);
      expect(fetcher.isDomainAllowed('')).toBe(false);
    });
  });
});
