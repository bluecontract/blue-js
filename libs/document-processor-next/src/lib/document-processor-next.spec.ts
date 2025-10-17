import { documentProcessorNext } from './document-processor-next.js';

describe('documentProcessorNext', () => {
  it('should work', () => {
    expect(documentProcessorNext()).toEqual('document-processor-next');
  });
});
