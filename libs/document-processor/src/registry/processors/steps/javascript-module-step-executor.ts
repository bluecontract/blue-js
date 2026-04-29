import { createHash } from 'node:crypto';

import type { BlueNode } from '@blue-labs/language';
import type { ModulePackV1 } from '@blue-quickjs/quickjs-runtime';

import {
  JAVASCRIPT_MODULE_BLUE_ID,
  JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID,
  JAVASCRIPT_MODULE_CODE_STEP_TYPE_NAME,
  JAVASCRIPT_MODULE_PACK_BUILDER_VERSION,
  JAVASCRIPT_MODULE_PACK_DEPENDENCY_INTEGRITY,
} from '../../../constants/javascript-module-constants.js';
import { CodeBlockEvaluationError } from '../../../util/expression/exceptions.js';
import type { JavaScriptEvaluationEngine } from '../../../util/expression/javascript-evaluation-engine.js';
import { getJavaScriptExecutionPolicy } from '../../../util/expression/javascript-execution-policy.js';
import type { ContractProcessorContext } from '../../types.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { createQuickJSStepBindings } from './quickjs-step-bindings.js';

interface ResultWithEvents {
  readonly events: readonly unknown[];
  readonly [key: string]: unknown;
}

interface JavaScriptModuleCodeStep {
  readonly entrySpecifier: string;
  readonly entryExport?: string;
  readonly modules: readonly ModuleReference[];
}

type ModuleReference = string | { readonly path?: string };

interface JavaScriptModuleContract {
  readonly specifier: string;
  readonly source: string;
  readonly sourceMap?: string;
}

interface JavaScriptModuleStepExecutorOptions {
  readonly wasmGasLimit?: bigint | number;
}

export class JavaScriptModuleStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID] as const;
  readonly supportedTypeNames = [
    JAVASCRIPT_MODULE_CODE_STEP_TYPE_NAME,
  ] as const;

  private readonly wasmGasLimit: bigint | number;

  constructor(
    private readonly engine: JavaScriptEvaluationEngine,
    options: JavaScriptModuleStepExecutorOptions = {},
  ) {
    this.wasmGasLimit =
      options.wasmGasLimit ??
      getJavaScriptExecutionPolicy(engine).jsCodeStepGasLimit;
  }

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const step = this.readStep(stepNode, context);
    const modulePack = this.createModulePack(step, context);

    try {
      const result = await this.engine.evaluate({
        modulePack,
        bindings: createQuickJSStepBindings(args),
        wasmGasLimit: this.wasmGasLimit,
        onWasmGasUsed: ({ used }) => context.gasMeter().chargeWasmGas(used),
      });

      this.handleEvents(result, context);
      return result;
    } catch (error) {
      throw new CodeBlockEvaluationError(
        `module pack entry ${step.entrySpecifier}`,
        error,
      );
    }
  }

  private readStep(
    stepNode: BlueNode,
    context: ContractProcessorContext,
  ): JavaScriptModuleCodeStep {
    const props = stepNode.getProperties() ?? {};
    const entrySpecifier = readRequiredString(
      props.entrySpecifier,
      'JavaScript Module Code step requires entrySpecifier',
      context,
    );
    const entryExport = readOptionalString(props.entryExport);
    const modulesNode = props.modules;
    const moduleItems = modulesNode?.getItems();
    if (!moduleItems || moduleItems.length === 0) {
      return context.throwFatal(
        'JavaScript Module Code step requires at least one module reference',
      );
    }

    return {
      entrySpecifier,
      ...(entryExport ? { entryExport } : {}),
      modules: moduleItems.map((item) => this.readModuleReference(item)),
    };
  }

  private readModuleReference(node: BlueNode): ModuleReference {
    const value = node.getValue();
    if (typeof value === 'string') {
      return value;
    }
    const path = readOptionalString(node.getProperties()?.path);
    return path ? { path } : {};
  }

  private createModulePack(
    step: JavaScriptModuleCodeStep,
    context: ContractProcessorContext,
  ): ModulePackV1 {
    const modules = step.modules.map((reference) =>
      this.loadModule(reference, context),
    );
    assertUniqueSpecifiers(modules, context);
    assertEntrySpecifier(step.entrySpecifier, modules, context);

    const modulePackWithoutHash = {
      version: 1 as const,
      entrySpecifier: step.entrySpecifier,
      ...(step.entryExport ? { entryExport: step.entryExport } : {}),
      modules,
      builderVersion: JAVASCRIPT_MODULE_PACK_BUILDER_VERSION,
      dependencyIntegrity: JAVASCRIPT_MODULE_PACK_DEPENDENCY_INTEGRITY,
    };

    return {
      ...modulePackWithoutHash,
      graphHash: computeModulePackGraphHash(modulePackWithoutHash),
    };
  }

  private loadModule(
    reference: ModuleReference,
    context: ContractProcessorContext,
  ): ModulePackV1['modules'][number] {
    const path = typeof reference === 'string' ? reference : reference.path;
    if (!path || path.trim().length === 0) {
      return context.throwFatal(
        'JavaScript Module Code module reference requires a path',
      );
    }

    const absolutePath = context.resolvePointer(path.trim());
    const moduleNode = context.documentAt(absolutePath);
    if (!moduleNode) {
      return context.throwFatal(
        `JavaScript module not found at "${absolutePath}"`,
      );
    }

    const moduleContract = this.readModuleContract(moduleNode, context);
    return {
      specifier: moduleContract.specifier,
      source: normalizeModuleSource(moduleContract.source),
      ...(moduleContract.sourceMap
        ? { sourceMap: moduleContract.sourceMap }
        : {}),
    };
  }

  private readModuleContract(
    moduleNode: BlueNode,
    context: ContractProcessorContext,
  ): JavaScriptModuleContract {
    const blueId = moduleNode.getType()?.getBlueId();
    if (blueId !== JAVASCRIPT_MODULE_BLUE_ID) {
      return context.throwFatal(
        'JavaScript module references must point to Conversation/JavaScript Module contracts',
      );
    }

    const props = moduleNode.getProperties() ?? {};
    return {
      specifier: readRequiredString(
        props.specifier,
        'JavaScript Module contract requires specifier',
        context,
      ),
      source: readRequiredString(
        props.source,
        'JavaScript Module contract requires source',
        context,
      ),
      ...(readOptionalString(props.sourceMap)
        ? { sourceMap: readOptionalString(props.sourceMap) }
        : {}),
    };
  }

  private handleEvents(
    result: unknown,
    context: ContractProcessorContext,
  ): void {
    if (!result || typeof result !== 'object') {
      return;
    }
    const maybeContainer = result as Partial<ResultWithEvents>;
    if (!Array.isArray(maybeContainer.events)) {
      return;
    }
    for (const event of maybeContainer.events) {
      const eventNode = context.blue.jsonValueToNode(event);
      context.emitEvent(eventNode);
    }
  }
}

function readRequiredString(
  node: BlueNode | undefined,
  message: string,
  context: ContractProcessorContext,
): string {
  const value = readOptionalString(node);
  if (!value) {
    return context.throwFatal(message);
  }
  return value;
}

function readOptionalString(node: BlueNode | undefined): string | undefined {
  const value = node?.getValue();
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeModuleSource(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

function assertUniqueSpecifiers(
  modules: readonly ModulePackV1['modules'][number][],
  context: ContractProcessorContext,
): void {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.specifier)) {
      return context.throwFatal(
        `Duplicate JavaScript module specifier "${module.specifier}"`,
      );
    }
    seen.add(module.specifier);
  }
}

function assertEntrySpecifier(
  entrySpecifier: string,
  modules: readonly ModulePackV1['modules'][number][],
  context: ContractProcessorContext,
): void {
  if (!modules.some((module) => module.specifier === entrySpecifier)) {
    return context.throwFatal(
      `JavaScript module entry "${entrySpecifier}" was not provided`,
    );
  }
}

function computeModulePackGraphHash(
  modulePack: Omit<ModulePackV1, 'graphHash'>,
): string {
  const canonical = {
    version: modulePack.version,
    entrySpecifier: modulePack.entrySpecifier,
    entryExport: modulePack.entryExport ?? 'default',
    modules: [...modulePack.modules]
      .sort((left, right) =>
        compareUtf8ByteOrder(left.specifier, right.specifier),
      )
      .map((module) => ({
        specifier: module.specifier,
        source: module.source,
        ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
      })),
    builderVersion: modulePack.builderVersion,
    dependencyIntegrity: modulePack.dependencyIntegrity,
  };

  return createHash('sha256')
    .update(stableStringify(canonical), 'utf8')
    .digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => compareUtf8ByteOrder(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

const UTF8_ENCODER = new TextEncoder();

function compareUtf8ByteOrder(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftBytes = UTF8_ENCODER.encode(left);
  const rightBytes = UTF8_ENCODER.encode(right);
  const limit = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < limit; index += 1) {
    const delta = leftBytes[index] - rightBytes[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return leftBytes.length - rightBytes.length;
}
