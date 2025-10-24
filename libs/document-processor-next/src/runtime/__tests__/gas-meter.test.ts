import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';

import { GasMeter } from '../gas-meter.js';
import { canonicalSize } from '../../util/node-canonicalizer.js';

const blue = new Blue();

function nodeFrom(json: unknown) {
  return blue.jsonValueToNode(json);
}

describe('GasMeter', () => {
  it('charges initialization and scope depth', () => {
    const meter = new GasMeter();
    meter.chargeInitialization();
    meter.chargeScopeEntry('/child/grandchild');
    meter.chargeScopeEntry('nested/scope');

    // Initialization 1000 + depth (2 -> 70) + depth (2 -> 70)
    expect(meter.totalGas()).toBe(1_000 + 70 + 70);
  });

  it('charges patch add/replace proportional to canonical size', () => {
    const meter = new GasMeter();
    const valueNode = nodeFrom({ payload: { answer: 42 } });
    const expectedSizeCharge = Math.floor((canonicalSize(valueNode) + 99) / 100);

    meter.chargePatchAddOrReplace(valueNode);

    expect(meter.totalGas()).toBe(20 + expectedSizeCharge);
  });

  it('charges event emission and cascade routing', () => {
    const meter = new GasMeter();
    const event = nodeFrom({ eventType: 'Lifecycle', data: { id: 'evt-1' } });
    const sizeCharge = Math.floor((canonicalSize(event) + 99) / 100);

    meter.chargeEmitEvent(event);
    meter.chargeCascadeRouting(3);
    meter.chargeCascadeRouting(0); // should be ignored

    expect(meter.totalGas()).toBe(20 + sizeCharge + 30);
  });
});
