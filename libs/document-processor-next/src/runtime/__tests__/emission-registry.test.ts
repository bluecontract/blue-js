import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';

import { EmissionRegistry } from '../emission-registry.js';

const blue = new Blue();

function nodeFrom(json: unknown) {
  return blue.jsonValueToNode(json);
}

describe('EmissionRegistry', () => {
  it('creates and reuses scope runtime contexts', () => {
    const registry = new EmissionRegistry();

    const contextA = registry.scope('/root');
    const contextB = registry.scope('/root');

    expect(contextA).toBe(contextB);
    expect(registry.existingScope('/missing')).toBeUndefined();
  });

  it('records root emissions in order', () => {
    const registry = new EmissionRegistry();
    const first = nodeFrom({ id: '1' });
    const second = nodeFrom({ id: '2' });

    registry.recordRootEmission(first);
    registry.recordRootEmission(second);

    expect(registry.rootEmissions()).toEqual([first, second]);
  });

  it('tracks terminated scopes and allows clearing', () => {
    const registry = new EmissionRegistry();
    const scope = registry.scope('/child');
    scope.finalizeTermination('GRACEFUL', null);

    expect(registry.isScopeTerminated('/child')).toBe(true);
    registry.clearScope('/child');
    expect(registry.isScopeTerminated('/child')).toBe(false);
  });
});
