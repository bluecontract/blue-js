import { describe, expect, it } from 'vitest';
import { fromChannel, fromEmail } from '../bootstrap-bindings.js';

describe('bootstrap binding helpers', () => {
  it('maps fromChannel(...) to parent accountId expressions', () => {
    expect(fromChannel('ownerChannel')).toEqual({
      accountId: "${document('/contracts/ownerChannel/accountId')}",
    });
  });

  it('maps fromEmail(...) to parent email expressions', () => {
    expect(fromEmail('ownerChannel')).toEqual({
      email: "${document('/contracts/ownerChannel/email')}",
    });
  });

  it('trims channel keys before building expressions', () => {
    expect(fromChannel('  ownerChannel  ')).toEqual({
      accountId: "${document('/contracts/ownerChannel/accountId')}",
    });
    expect(fromEmail('  ownerChannel  ')).toEqual({
      email: "${document('/contracts/ownerChannel/email')}",
    });
  });

  it('escapes JSON Pointer control characters in channel keys', () => {
    expect(fromChannel('a/b~c')).toEqual({
      accountId: "${document('/contracts/a~1b~0c/accountId')}",
    });
    expect(fromEmail('a/b~c')).toEqual({
      email: "${document('/contracts/a~1b~0c/email')}",
    });
  });

  it('rejects blank channel keys', () => {
    expect(() => fromChannel('   ')).toThrow('channelKey is required');
    expect(() => fromEmail('')).toThrow('channelKey is required');
  });
});
