import { UrlNodeProvider } from '../UrlNodeProvider';
import { BlueNode } from '../../model';

// Note: In a real environment, you would use jest.mock('axios')
// but we're avoiding that here due to linter issues

describe('UrlNodeProvider', () => {
  let provider: UrlNodeProvider;

  beforeEach(() => {
    provider = new UrlNodeProvider();
    // Clear the cache before each test
    provider.clearCache();
  });

  test('should identify if a string is a URL', () => {
    expect(provider.canHandle('https://example.com/blue.json')).toBe(true);
    expect(provider.canHandle('http://localhost:8080/data.yaml')).toBe(true);
    expect(provider.canHandle('not-a-url')).toBe(false);
    expect(provider.canHandle('file:///path/to/file.json')).toBe(false); // file protocol is not supported
  });

  test('should return empty array for non-URL blueIds', () => {
    const result = provider.fetchByBlueId('not-a-url');
    expect(result).toEqual([]);
  });

  test('should prefetch and return nodes for a URL', () => {
    const mockNode = new BlueNode().setValue('test');
    provider.prefetchUrl('https://example.com/data.json', [mockNode]);

    const result = provider.fetchByBlueId('https://example.com/data.json');
    expect(result).toHaveLength(1);
    expect(result[0].getValue()).toBe('test');
  });

  test('should return empty array on first call to a URL', () => {
    // First call should return empty since fetch is async
    const result = provider.fetchByBlueId('https://example.com/data.json');
    expect(result).toEqual([]);
  });

  test('should clear cache', () => {
    const mockNode = new BlueNode().setValue('test');
    provider.prefetchUrl('https://example.com/data.json', [mockNode]);

    // Cache should be populated
    expect(
      provider.fetchByBlueId('https://example.com/data.json')
    ).toHaveLength(1);

    // Clear cache
    provider.clearCache();

    // Cache should be empty
    expect(provider.fetchByBlueId('https://example.com/data.json')).toEqual([]);
  });
});
