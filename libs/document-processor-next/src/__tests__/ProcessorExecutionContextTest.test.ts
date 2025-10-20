import { describe, it, expect } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import { ContractLoader } from '../engine/contract-loader.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import { ContractBundle } from '../engine/contract-bundle.js';
const blue = new Blue();

function createEngine(): ProcessorEngine {
  const registry = ContractProcessorRegistryBuilder.create().build();
  const loader = new ContractLoader(registry, blue);
  return new ProcessorEngine(loader, registry, blue);
}

describe('ProcessorExecutionContextTest', () => {
  it('documentHelpersExposeSnapshots', () => {
    const document = blue.jsonValueToNode({
      value: 1,
      nested: { inner: 'x' },
    });
    const engine = createEngine();
    const execution = engine.createExecution(document.clone());
    execution.loadBundles('/');
    const bundle = execution.bundleForScope('/') ?? ContractBundle.empty();

    const context = execution.createContext(
      '/',
      bundle,
      new BlueNode(),
      false,
      false
    );

    const snapshot = context.documentAt('/nested/inner');
    expect(snapshot?.getValue()).toBe('x');

    const missing = context.documentAt('/unknown');
    expect(missing).toBeNull();

    expect(context.documentContains('/value')).toBe(true);
    expect(context.documentContains('/value/missing')).toBe(false);

    snapshot?.setValue?.('mutated');
    const reread = context.documentAt('/nested/inner');
    expect(reread?.getValue()).toBe('x');
  });

  it('emitEventQueuesAndChargesGas', () => {
    const engine = createEngine();
    const execution = engine.createExecution(new BlueNode());
    execution.loadBundles('/');
    const bundle = execution.bundleForScope('/') ?? ContractBundle.empty();

    const context = execution.createContext(
      '/',
      bundle,
      new BlueNode(),
      false,
      false
    );

    context.emitEvent(new BlueNode().setValue('payload'));

    const scopeRuntime = execution.runtime().scope('/');
    expect(scopeRuntime.triggeredSize()).toBe(1);
    expect(execution.runtime().totalGas()).toBeGreaterThanOrEqual(20);
  });
});
