import { describe, expect, it, vi } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';
import { buildModulePackFromSources } from '@blue-quickjs/quickjs-runtime';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { JavaScriptCodeStepExecutor } from '../javascript-code-step-executor.js';
import { CodeBlockEvaluationError } from '../../../../util/expression/exceptions.js';
import { typeBlueId } from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { hostGasToWasmFuel } from '../../../../util/expression/quickjs-config.js';
import {
  BlueQuickJsEngine,
  type JavaScriptEvaluationEngine,
  type JavaScriptEvaluationOptions,
} from '../../../../util/expression/javascript-evaluation-engine.js';
import { createDocumentJavaScriptExecutionPolicy } from '../../../../util/expression/javascript-execution-policy.js';
import { ProcessorFatalError } from '../../../../engine/processor-fatal-error.js';

function createStepNode(blue: Blue, code: string): BlueNode {
  const indented = code
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  const yaml = `type: Conversation/JavaScript Code\ncode: |\n${indented}\n`;
  return blue.yamlToNode(yaml);
}

function createV2StepNode(blue: Blue, yamlBody: string): BlueNode {
  return blue.yamlToNode(`type: Conversation/JavaScript Code v2\n${yamlBody}`);
}

describe('JavaScriptCodeStepExecutor', () => {
  const engine = new BlueQuickJsEngine();
  const executor = new JavaScriptCodeStepExecutor(engine);

  it('evaluates code and returns plain result', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return { doubled: 21 * 2 };');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toEqual({ doubled: 42 });
  });

  it('routes code evaluation through the injected engine', async () => {
    const blue = createBlue();
    const code = 'return { status: event.payload.status };';
    const stepNode = createStepNode(blue, code);
    const eventNode = blue.jsonValueToNode({
      payload: { status: 'complete' },
    });
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        options.onWasmGasUsed?.({ used: 11n, remaining: 89n });
        return { status: 'from-engine' };
      },
    };
    const injectedExecutor = new JavaScriptCodeStepExecutor(fakeEngine, {
      wasmGasLimit: 100n,
    });
    const gasSpy = vi.spyOn(context.gasMeter(), 'chargeWasmGas');

    const result = await injectedExecutor.execute(args);

    expect(result).toEqual({ status: 'from-engine' });
    expect(calls).toHaveLength(1);
    expect(calls[0].code.trimEnd()).toBe(code);
    expect(calls[0].wasmGasLimit).toBe(100n);
    expect(calls[0].bindings?.event).toEqual({
      payload: { status: 'complete' },
    });
    expect(gasSpy).toHaveBeenCalledWith(11n);
  });

  it('routes JavaScript Code v2 auto script mode through code evaluation', async () => {
    const blue = createBlue();
    const code = 'return 123;';
    const stepNode = createV2StepNode(
      blue,
      `name: Compute
code: ${JSON.stringify(code)}
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        return 123;
      },
    };

    const result = await new JavaScriptCodeStepExecutor(fakeEngine).execute(
      args,
    );

    expect(result).toBe(123);
    expect(calls).toHaveLength(1);
    expect(calls[0].code).toBe(code);
    expect(calls[0].modulePack).toBeUndefined();
  });

  it('builds JavaScript Code v2 inline modules before module evaluation', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
code: |
  import { value } from './value.js';
  export default value + 1;
modules:
  './value.js': |
    export const value = 41;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        return 42;
      },
    };

    const result = await new JavaScriptCodeStepExecutor(fakeEngine).execute(
      args,
    );

    expect(result).toBe(42);
    expect(calls).toHaveLength(1);
    expect(calls[0].code).toBeUndefined();
    expect(calls[0].modulePack?.entrySpecifier).toBe('./entry.js');
    expect(
      calls[0].modulePack?.modules.map((module) => module.specifier),
    ).toEqual(['./entry.js', './value.js']);
  });

  it('builds JavaScript Code v2 modules from reusable source libraries', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
libraries:
  - /contracts/mathLibrary
code: |
  import { value } from './value.js';
  export default value + 1;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite(
      '/contracts/mathLibrary',
      blue.yamlToNode(`type: Conversation/JavaScript Library
modules:
  './value.js': |
    export const value = 41;
`),
    );
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        return 42;
      },
    };

    const result = await new JavaScriptCodeStepExecutor(fakeEngine).execute(
      args,
    );

    expect(result).toBe(42);
    expect(calls).toHaveLength(1);
    expect(
      calls[0].modulePack?.modules.map((module) => module.specifier),
    ).toEqual(['./entry.js', './value.js']);
  });

  it('imports JavaScript Code v2 artifact libraries through aliases', async () => {
    const blue = createBlue();
    const artifactPack = await buildModulePackFromSources({
      entrySpecifier: './index.js',
      sources: [
        {
          specifier: './index.js',
          source: 'export function value() { return 41; }',
          originMeta: {
            packageName: 'math-lib',
            packageVersion: '1.0.0',
          },
        },
      ],
    });
    const stepNode = createV2StepNode(
      blue,
      `mode: module
libraries:
  - /contracts/mathLibrary
code: |
  import { value } from 'math-lib';
  export default value() + 1;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite(
      '/contracts/mathLibrary',
      blue.jsonValueToNode({
        type: {
          blueId: conversationBlueIds['Conversation/JavaScript Library'],
        },
        package: {
          registry: 'npm',
          packageName: 'math-lib',
          version: '1.0.0',
          sourceIntegritySha256: 'a'.repeat(64),
        },
        artifact: {
          builderVersion: artifactPack.builderVersion,
          dependencyIntegrity: artifactPack.dependencyIntegrity,
          graphHash: artifactPack.graphHash,
          modulePack: artifactPack,
        },
        moduleAliases: {
          'math-lib': './index.js',
        },
      }),
    );
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        return 42;
      },
    };

    const result = await new JavaScriptCodeStepExecutor(fakeEngine).execute(
      args,
    );

    expect(result).toBe(42);
    expect(
      calls[0].modulePack?.modules.map((module) => module.specifier),
    ).toEqual(['./entry.js', './index.js']);
  });

  it('rejects JavaScript Code v2 duplicate module specifiers', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
libraries:
  - /contracts/mathLibrary
code: |
  import { value } from './value.js';
  export default value;
modules:
  './value.js': export const value = 1;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite(
      '/contracts/mathLibrary',
      blue.yamlToNode(`type: Conversation/JavaScript Library
modules:
  './value.js': export const value = 2;
`),
    );
    const args = createArgs({ context, stepNode, eventNode });

    await expect(
      new JavaScriptCodeStepExecutor(engine).execute(args),
    ).rejects.toThrow(ProcessorFatalError);
  });

  it('rejects JavaScript Code v2 invalid module specifiers', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
code: |
  import { value } from '../value.js';
  export default value;
modules:
  '../value.js': export const value = 1;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    await expect(
      new JavaScriptCodeStepExecutor(engine).execute(args),
    ).rejects.toThrow(ProcessorFatalError);
  });

  it('uses JavaScript Code v2 named entryExport in module mode', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
entryExport: compute
code: |
  export const ignored = 1;
  export const compute = 42;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate(options) {
        calls.push(options);
        return 42;
      },
    };

    const result = await new JavaScriptCodeStepExecutor(fakeEngine).execute(
      args,
    );

    expect(result).toBe(42);
    expect(calls[0].modulePack?.entryExport).toBe('compute');
  });

  it('rejects JavaScript Code v2 artifact hash mismatches', async () => {
    const blue = createBlue();
    const artifactPack = await buildModulePackFromSources({
      entrySpecifier: './index.js',
      sources: [
        {
          specifier: './index.js',
          source: 'export const value = 41;',
        },
      ],
    });
    const stepNode = createV2StepNode(
      blue,
      `mode: module
libraries:
  - /contracts/mathLibrary
code: |
  import { value } from './index.js';
  export default value;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite(
      '/contracts/mathLibrary',
      blue.jsonValueToNode({
        type: {
          blueId: conversationBlueIds['Conversation/JavaScript Library'],
        },
        package: {
          registry: 'blue',
          packageName: 'math-lib',
          version: '1.0.0',
          sourceIntegritySha256: 'b'.repeat(64),
        },
        artifact: {
          builderVersion: artifactPack.builderVersion,
          dependencyIntegrity: artifactPack.dependencyIntegrity,
          graphHash: 'c'.repeat(64),
          modulePack: artifactPack,
        },
      }),
    );
    const args = createArgs({ context, stepNode, eventNode });

    await expect(
      new JavaScriptCodeStepExecutor(engine).execute(args),
    ).rejects.toThrow(ProcessorFatalError);
  });

  it('rejects JavaScript Code v2 script mode when module fields are present', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: script
code: return 1;
modules:
  './value.js': export const value = 1;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    await expect(
      new JavaScriptCodeStepExecutor(engine).execute(args),
    ).rejects.toThrow(ProcessorFatalError);
  });

  it('rejects JavaScript Code v2 missing static imports before evaluation', async () => {
    const blue = createBlue();
    const stepNode = createV2StepNode(
      blue,
      `mode: module
code: |
  import { missing } from './missing.js';
  export default missing;
`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const fakeEngine: JavaScriptEvaluationEngine = {
      async evaluate() {
        throw new Error('engine should not be called');
      },
    };

    await expect(
      new JavaScriptCodeStepExecutor(fakeEngine).execute(args),
    ).rejects.toThrow(ProcessorFatalError);
  });

  it('uses the engine JavaScript Code step gas policy', async () => {
    const blue = createBlue();
    const code = 'return 1;';
    const stepNode = createStepNode(blue, code);
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });
    const calls: JavaScriptEvaluationOptions[] = [];
    const policyEngine: JavaScriptEvaluationEngine = {
      executionPolicy: createDocumentJavaScriptExecutionPolicy({
        jsCodeStepGasLimit: 333n,
      }),
      async evaluate(options) {
        calls.push(options);
        return 1;
      },
    };
    const policyExecutor = new JavaScriptCodeStepExecutor(policyEngine);

    await policyExecutor.execute(args);

    expect(calls).toHaveLength(1);
    expect(calls[0].wasmGasLimit).toBe(333n);
  });

  it('exposes the event binding', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return event.payload.amount * 2;');
    const eventNode = blue.jsonValueToNode({
      payload: { amount: 7 },
    });
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe(14);
  });

  it('exposes canonical event data and canon helper utilities', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonicalId = canon.at(eventCanonical, '/payload/id');
        return {
          plain: event.payload.id,
          canonicalWrapped: canonicalId,
          canonicalValue: canonicalId?.value,
          unwrapped: canon.unwrap(canonicalId)
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({
      payload: { id: 'evt-123' },
    });
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.plain).toBe('evt-123');
    expect(result.unwrapped).toBe(result.plain);
    expect(result.canonicalValue).toBe('evt-123');
    expect(result.canonicalWrapped).toMatchObject({ value: 'evt-123' });
  });

  it('provides access to documents via document()', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return document("/counter") * 3;');
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));

    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe(15);
  });

  it('exposes canonical document snapshots alongside plain values', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonical = document.canonical('/counter');
        return {
          plain: document('/counter'),
          normalized: document('counter'),
          canonicalWrapped: canonical,
          canonicalValue: canonical?.value,
          unwrapped: canon.unwrap(canonical),
          missingPlain: document('/missing'),
          missingCanonical: document.canonical('/missing')
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.plain).toBe(5);
    expect(result.normalized).toBe(5);
    expect(result.unwrapped).toBe(result.plain);
    expect(result.canonicalValue).toBe(5);
    expect(result.canonicalWrapped).toMatchObject({ value: 5 });
    expect(result.missingPlain).toBeNull();
    expect(result.missingCanonical).toBeNull();
  });

  it('returns blueId when document() path ends with /blueId', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        const canonical = document.canonical('/propA/blueId');
        return {
          blueId: document('/propA/blueId'),
          canonical,
          canonicalValue: canonical
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const propNode = new BlueNode().setName('PropA');
    const propABlueId = blue.calculateBlueIdSync(propNode);
    execution.runtime().directWrite('/propA', propNode);

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result.blueId).toBe(propABlueId);
    expect(result.canonicalValue).toBe(propABlueId);
    expect(result.canonical).toBe(propABlueId);
  });

  it('supports special document() segments like name/description/type/value', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `
        return {
          name: document('/prop/name'),
          description: document('/prop/description'),
          typeName: document('/prop/type/name'),
          value: document('/prop/value'),
          blueId: document('/prop/blueId'),
          canonical: {
            name: document.canonical('/prop/name'),
            description: document.canonical('/prop/description'),
            typeName: document.canonical('/prop/type/name'),
            value: document.canonical('/prop/value'),
            blueId: document.canonical('/prop/blueId')
          }
        };
      `,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const propNode = new BlueNode()
      .setName('Prop A')
      .setDescription('Desc')
      .setType(new BlueNode().setName('TypeX'))
      .setValue(7);
    execution.runtime().directWrite('/prop', propNode);
    const expectedBlueId = blue.calculateBlueIdSync(propNode);

    const args = createArgs({ context, stepNode, eventNode });

    const result = (await executor.execute(args)) as Record<string, unknown>;
    expect(result).toMatchObject({
      name: 'Prop A',
      description: 'Desc',
      typeName: 'TypeX',
      value: 7,
      blueId: expectedBlueId,
      canonical: {
        name: 'Prop A',
        description: 'Desc',
        typeName: 'TypeX',
        value: 7,
        blueId: expectedBlueId,
      },
    });
  });

  it('provides previous step results', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return steps.Compute.value + 8;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({
      context,
      stepNode,
      eventNode,
      stepResults: { Compute: { value: 12 } },
    });

    const result = await executor.execute(args);
    expect(result).toBe(20);
  });

  it('rejects async/await expressions', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      'const value = await Promise.resolve(11); return value;',
    );
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });

  it('emits events included in the result payload', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(
      blue,
      `return {
        status: 'done',
        events: [
          {
            type: "Conversation/Chat Message",
            message: "Workflow finished"
          }
        ]
      };`,
    );
    const eventNode = blue.jsonValueToNode({});
    const { context, execution } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toMatchObject({ status: 'done' });

    const emitted = execution.runtime().rootEmissions();
    expect(emitted).toHaveLength(1);
    const emittedEvent = emitted[0];
    expect(typeBlueId(emittedEvent)).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    const message = emittedEvent.getProperties()?.message?.getValue();
    expect(message).toBe('Workflow finished');
  });

  it('wraps thrown errors in CodeBlockEvaluationError', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'throw new Error("boom");');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });

  it('enforces execution gas limits for runaway code', async () => {
    const blue = createBlue();
    const limitedExecutor = new JavaScriptCodeStepExecutor(engine, {
      wasmGasLimit: hostGasToWasmFuel(1000),
    });
    const stepNode = createStepNode(blue, 'while (true) {}');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({
      context,
      stepNode,
      eventNode,
    });

    await expect(limitedExecutor.execute(args)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });

  it('charges wasm gas usage into the gas meter', async () => {
    const blue = createBlue();
    const code = `
return 1;
    `;
    const stepNode = createStepNode(blue, code);
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const spy = vi.spyOn(context.gasMeter(), 'chargeWasmGas');

    await executor.execute(args);

    expect(spy).toHaveBeenCalled();
    const [firstCharge] = spy.mock.calls[0] ?? [];

    expect(
      typeof firstCharge === 'bigint' ? firstCharge > 0n : firstCharge > 0,
    ).toBe(true);
  });

  it('does not expose Date for deterministic execution', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return typeof Date;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe('undefined');
  });

  it('does not expose Node.js process global', async () => {
    const blue = createBlue();
    const stepNode = createStepNode(blue, 'return typeof process;');
    const eventNode = blue.jsonValueToNode({});
    const { context } = createRealContext(blue, eventNode);
    const args = createArgs({ context, stepNode, eventNode });

    const result = await executor.execute(args);
    expect(result).toBe('undefined');
  });
});
