import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickJsHostBridge } from '../QuickJsHostBridge';

const ENTRY_SOURCE = `(() => {
  const host = globalThis.__BLUE_HOST__;
  const entry = {
    initialize(document, options) {
      host?.log?.('info', 'init called');
      return {
        document,
        options,
      };
    },
  };
  globalThis.__BLUE_ENTRY__ = entry;
  return entry;
})()`;

describe('QuickJsHostBridge', () => {
  let bridge: QuickJsHostBridge | undefined;

  afterEach(async () => {
    if (bridge) {
      await bridge.dispose();
      bridge = undefined;
    }
  });

  it('invokes processor methods and bridges host APIs', async () => {
    const logSpy = vi.fn();
    const nowSpy = vi.fn(() => 42);
    const loadBlueContent = vi.fn((blueId: string) =>
      Promise.resolve(`content:${blueId}`)
    );

    bridge = new QuickJsHostBridge({
      entrySource: ENTRY_SOURCE,
      hostApis: {
        log: logSpy,
        now: nowSpy,
        loadBlueContent,
      },
    });

    const initResponse = await bridge.call({
      method: 'initialize',
      document: { foo: 'bar' },
      options: { gasBudget: 100 },
    });

    expect(initResponse.ok).toBe(true);
    expect(initResponse.result).toStrictEqual({
      document: { foo: 'bar' },
      options: { gasBudget: 100 },
    });
    expect(logSpy).toHaveBeenCalledWith('info', 'init called');
  });

  it('returns structured error when method is missing', async () => {
    bridge = new QuickJsHostBridge({ entrySource: ENTRY_SOURCE });

    const response = await bridge.call({
      method: 'initialize',
      document: null,
    } as any);
    expect(response.ok).toBe(true);

    const missing = await bridge.call({
      method: 'nonExisting' as 'initialize',
      document: null,
    });

    expect(missing.ok).toBe(false);
    expect(missing.error?.message).toContain('not found');
  });
});
