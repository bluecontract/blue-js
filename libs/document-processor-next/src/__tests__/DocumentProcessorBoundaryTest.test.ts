import { createBlue } from '../test-support/blue.js';
import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import { ContractLoader } from '../engine/contract-loader.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import { ContractBundle } from '../engine/contract-bundle.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { RunTerminationError } from '../engine/run-termination-error.js';
import type { ProcessEmbeddedMarker } from '../model/index.js';
import { property } from './test-utils.js';

const blue = createBlue();

function createEngine(): ProcessorEngine {
  const registry = ContractProcessorRegistryBuilder.create().build();
  const loader = new ContractLoader(registry, blue);
  return new ProcessorEngine(loader, registry, blue);
}

function valueNode(value: unknown): BlueNode {
  return blue.jsonValueToNode(value);
}

function addPatch(path: string, val: BlueNode): JsonPatch {
  return { op: 'ADD', path, val } as JsonPatch;
}

function replacePatch(path: string, val: BlueNode): JsonPatch {
  return { op: 'REPLACE', path, val } as JsonPatch;
}

function removePatch(path: string): JsonPatch {
  return { op: 'REMOVE', path } as JsonPatch;
}

describe('DocumentProcessorBoundaryTest', () => {
  it('allowsPatchingWithinScopeUsingLiteralSegments', () => {
    const engine = createEngine();
    const document = new BlueNode();
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    execution.handlePatch(
      '/foo',
      bundle,
      addPatch('/foo//bar', valueNode('ok')),
      false,
    );

    const foo = property(document, 'foo');
    const literal = property(foo, '');
    const bar = property(literal, 'bar');
    expect(bar.getValue()).toBe('ok');
  });

  it('deniesPatchingOutsideScope', () => {
    const engine = createEngine();
    const document = new BlueNode();
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    execution.handlePatch(
      '/foo',
      bundle,
      addPatch('/bar', valueNode('oops')),
      false,
    );
    const result = execution.result();
    const resultDoc = result.document;
    const foo = property(resultDoc, 'foo');
    const contracts = property(foo, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
    expect(execution.runtime().isScopeTerminated('/foo')).toBe(true);
    const fooProps = foo.getProperties();
    expect(fooProps?.bar).toBeUndefined();
  });

  it('parentCannotModifyEmbeddedChildInterior', () => {
    const engine = createEngine();
    const document = new BlueNode();
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder()
      .setEmbedded({
        key: 'embedded',
        paths: ['/child'],
      } satisfies ProcessEmbeddedMarker)
      .build();

    execution.handlePatch(
      '/foo',
      bundle,
      addPatch('/foo/child/value', valueNode('nope')),
      false,
    );

    const resultDoc = execution.result().document;
    const foo = property(resultDoc, 'foo');
    const contracts = property(foo, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
    expect(execution.runtime().isScopeTerminated('/foo')).toBe(true);
    const fooProps = foo.getProperties();
    expect(fooProps?.child).toBeUndefined();
  });

  it('parentMayReplaceEntireEmbeddedChild', () => {
    const engine = createEngine();
    const child = new BlueNode().setProperties({
      value: valueNode('old'),
    });
    const parent = new BlueNode().setProperties({ child });
    const document = new BlueNode().setProperties({ foo: parent });
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder()
      .setEmbedded({
        key: 'embedded',
        paths: ['/child'],
      } satisfies ProcessEmbeddedMarker)
      .build();

    execution.handlePatch(
      '/foo',
      bundle,
      replacePatch('/foo/child', valueNode({ next: 'fresh' })),
      false,
    );

    const foo = property(document, 'foo');
    const replacedChild = property(foo, 'child');
    const next = property(replacedChild, 'next');
    expect(next.getValue()).toBe('fresh');
  });

  it('parentMayRemoveEntireEmbeddedChild', () => {
    const engine = createEngine();
    const child = new BlueNode().setProperties({
      value: valueNode('old'),
    });
    const parent = new BlueNode().setProperties({ child });
    const document = new BlueNode().setProperties({ foo: parent });
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder()
      .setEmbedded({
        key: 'embedded',
        paths: ['/child'],
      } satisfies ProcessEmbeddedMarker)
      .build();

    execution.handlePatch('/foo', bundle, removePatch('/foo/child'), false);

    const foo = property(document, 'foo');
    const props = foo.getProperties();
    expect(props?.child).toBeUndefined();
  });

  it('scopeCannotMutateItsOwnRoot', () => {
    const engine = createEngine();
    const document = new BlueNode().setProperties({
      foo: new BlueNode().setProperties({
        value: valueNode('existing'),
      }),
    });
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    execution.handlePatch(
      '/foo',
      bundle,
      replacePatch('/foo', valueNode('new')),
      false,
    );

    const resultDoc = execution.result().document;
    const foo = property(resultDoc, 'foo');
    const contracts = property(foo, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
    expect(execution.runtime().isScopeTerminated('/foo')).toBe(true);
    const value = property(foo, 'value');
    expect(value.getValue()).toBe('existing');
  });

  it('rootPatchTargetIsFatal', () => {
    const engine = createEngine();
    const document = new BlueNode().setProperties({
      foo: valueNode('ok'),
    });
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    expect(() =>
      execution.handlePatch('/', bundle, removePatch('/'), false),
    ).toThrow(RunTerminationError);

    const resultDoc = execution.result().document;
    const contracts = property(resultDoc, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
    expect(execution.runtime().isScopeTerminated('/')).toBe(true);
    const foo = property(resultDoc, 'foo');
    expect(foo.getValue()).toBe('ok');
  });

  it('reservedRootContractsAreWriteProtected', () => {
    const engine = createEngine();
    const document = new BlueNode();
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    expect(() =>
      execution.handlePatch(
        '/',
        bundle,
        addPatch('/contracts/checkpoint', valueNode('forbidden')),
        false,
      ),
    ).toThrow(RunTerminationError);

    const resultDoc = execution.result().document;
    const contracts = property(resultDoc, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
  });

  it('reservedContractsWithinScopeAreWriteProtected', () => {
    const engine = createEngine();
    const document = new BlueNode().setProperties({
      foo: new BlueNode(),
    });
    const execution = engine.createExecution(document);
    const bundle = ContractBundle.builder().build();

    execution.handlePatch(
      '/foo',
      bundle,
      addPatch('/foo/contracts/initialized', valueNode('bad')),
      false,
    );

    const resultDoc = execution.result().document;
    const foo = property(resultDoc, 'foo');
    const contracts = property(foo, 'contracts');
    const terminated = property(contracts, 'terminated');
    expect(terminated.getProperties()?.cause?.getValue()).toBe('fatal');
    const fooNode = property(resultDoc, 'foo');
    expect(fooNode.getProperties()).toHaveProperty('contracts');
  });
});
