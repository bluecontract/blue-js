import {
  BexEngine,
  BexException,
  BexExecutionContext,
  BexProgramSource,
  BexStepResults,
  BexValues,
} from '@blue-labs/bex';
import { BlueNode } from '@blue-labs/language';

import type { JsonPatch } from '../../../model/shared/json-patch.js';
import { conversationBlueIds } from '../../../repository/semantic-repository.js';
import type { ContractProcessorContext } from '../../types.js';
import type {
  SequentialWorkflowStepExecutor,
  StepExecutionArgs,
} from '../workflow/step-runner.js';
import { ProcessorBexDocumentView } from './processor-bex-document-view.js';

type JsonPatchOperation = 'ADD' | 'REPLACE' | 'REMOVE';

interface BexPatchSimple {
  readonly op?: unknown;
  readonly path?: unknown;
  readonly val?: unknown;
}

type BexResultObject = Record<string, unknown>;
type BexProgramField = 'constants' | 'do' | 'entry' | 'expr' | 'functions';

const BEX_PROGRAM_FIELDS: readonly BexProgramField[] = [
  'constants',
  'do',
  'entry',
  'expr',
  'functions',
];

const DOCUMENTATION_FIELD_KEYS = new Set([
  'blue',
  'blueId',
  'constraints',
  'contracts',
  'description',
  'itemType',
  'keyType',
  'mergePolicy',
  'order',
  'properties',
  'schema',
  'type',
  'valueType',
]);

export class BexComputeStepExecutor implements SequentialWorkflowStepExecutor {
  readonly supportedBlueIds = [
    conversationBlueIds['Conversation/Compute'],
  ] as const;

  constructor(private readonly engine = new BexEngine()) {}

  async execute(args: StepExecutionArgs): Promise<unknown> {
    const { context, stepNode } = args;
    const result = this.executeProgram(args);
    const value = result.value.toSimple();

    context.consumeGas(result.gasUsed);

    for (const change of this.changesToApply(
      value,
      result.changeset.toSimple(),
      context,
    )) {
      await context.applyPatch(this.toPatch(change, context));
    }

    const emitEvents = this.booleanProperty(stepNode, 'emitEvents', true);
    if (emitEvents) {
      for (const event of this.eventsToEmit(
        value,
        result.events.toSimple(),
        context,
      )) {
        context.emitEvent(context.blue.jsonValueToNode(event));
      }
    }

    return this.booleanProperty(stepNode, 'returnResult', true)
      ? this.stepResult(
          value,
          result.changeset.toSimple(),
          result.events.toSimple(),
        )
      : undefined;
  }

  private executeProgram(args: StepExecutionArgs) {
    try {
      return this.engine.compileAndExecute(
        this.programSource(args),
        this.executionContext(args),
      );
    } catch (error) {
      if (error instanceof BexException) {
        return args.context.throwFatal(
          `BEX Compute ${error.errorClass}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  private programSource(args: StepExecutionArgs): BexProgramSource {
    const definition = this.definitionNode(args);
    const programNode = this.programNode(args.stepNode);
    if (definition === undefined) {
      return BexProgramSource.inline(programNode, { inputKind: 'resolved' });
    }
    return BexProgramSource.withDefinition(
      programNode,
      this.programNode(definition),
      this.stringProperty(args.stepNode, 'entry'),
      { inputKind: 'resolved' },
    );
  }

  private programNode(node: BlueNode): BlueNode {
    const properties = node.getProperties() ?? {};
    const programProperties = Object.fromEntries(
      BEX_PROGRAM_FIELDS.flatMap((key) => {
        const value = properties[key];
        if (value === undefined || this.isDocumentationOnlyNode(value)) {
          return [];
        }
        return [[key, value.clone()]];
      }),
    );
    return new BlueNode().setProperties(programProperties);
  }

  private isDocumentationOnlyNode(node: BlueNode): boolean {
    if (node.getValue() !== undefined || node.getItems() !== undefined) {
      return false;
    }

    const properties = node.getProperties();
    if (properties === undefined) {
      return true;
    }

    return Object.keys(properties).every((key) =>
      DOCUMENTATION_FIELD_KEYS.has(key),
    );
  }

  private definitionNode(args: StepExecutionArgs): BlueNode | undefined {
    const definition = args.stepNode.getProperties()?.definition;
    if (definition === undefined) {
      return undefined;
    }

    const keyOrPointer = definition.getValue();
    if (typeof keyOrPointer === 'string') {
      const pointer = args.context.resolvePointer(
        this.definitionPointer(keyOrPointer, args.context),
      );
      const resolved = args.context.documentAt(pointer);
      if (resolved === null) {
        return args.context.throwFatal(
          `BEX Compute definition "${keyOrPointer}" was not found`,
        );
      }
      return resolved;
    }

    return definition.clone();
  }

  private definitionPointer(
    keyOrPointer: string,
    context: ContractProcessorContext,
  ): string {
    const trimmed = keyOrPointer.trim();
    if (trimmed.length === 0) {
      return context.throwFatal('BEX Compute definition cannot be empty');
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/contracts/${this.escapeJsonPointerSegment(trimmed)}`;
  }

  private escapeJsonPointerSegment(value: string): string {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private executionContext(args: StepExecutionArgs): BexExecutionContext {
    const scopeRootPointer = args.context.resolvePointer('/');
    const builder = BexExecutionContext.builder()
      .blue(args.context.blue)
      .documentView(
        new ProcessorBexDocumentView(args.context, scopeRootPointer),
      )
      .event(
        BexValues.nodeValueSnapshot(args.eventNode, {
          compactListsWithMetadata: true,
          compactScalarsWithMetadata: true,
        }),
      )
      .currentContract(BexValues.nodeSnapshot(args.contractNode ?? undefined))
      .steps(BexStepResults.fromSimple(args.stepResults))
      .gasLimit(this.numericProperty(args.stepNode, 'gasLimit', 1_000_000));
    return builder.build();
  }

  private toPatch(
    change: BexPatchSimple,
    context: ContractProcessorContext,
  ): JsonPatch {
    const op = this.patchOperation(change.op, context);
    const path =
      typeof change.path === 'string'
        ? context.resolvePointer(change.path)
        : context.throwFatal('BEX Compute changeset entry requires a path');
    if (op === 'REMOVE') {
      return { op, path };
    }
    return { op, path, val: context.blue.jsonValueToNode(change.val) };
  }

  private changesToApply(
    value: unknown,
    accumulatorChangeset: readonly unknown[],
    context: ContractProcessorContext,
  ): readonly BexPatchSimple[] {
    const rawChangeset =
      this.isResultObject(value) && Object.hasOwn(value, 'changeset')
        ? value.changeset
        : accumulatorChangeset;
    if (rawChangeset === undefined || rawChangeset === null) {
      return [];
    }
    if (!Array.isArray(rawChangeset)) {
      return context.throwFatal('Compute result changeset must be a list');
    }
    return rawChangeset.map((entry, index) => {
      if (!this.isResultObject(entry)) {
        return context.throwFatal(
          `Compute result changeset entry ${index} must be an object`,
        );
      }
      return entry;
    });
  }

  private patchOperation(
    rawOp: unknown,
    context: ContractProcessorContext,
  ): JsonPatchOperation {
    const upper = String(rawOp ?? 'replace').toUpperCase();
    if (upper === 'ADD' || upper === 'REPLACE' || upper === 'REMOVE') {
      return upper;
    }
    return context.throwFatal(
      `Unsupported BEX Compute patch op "${String(rawOp)}"`,
    );
  }

  private stepResult(
    value: unknown,
    changeset: readonly unknown[],
    events: readonly unknown[],
  ): unknown {
    if (!this.isResultObject(value)) {
      if (
        (value === undefined || value === null) &&
        (changeset.length > 0 || events.length > 0)
      ) {
        return {
          changeset: [...changeset],
          events: [...events],
        };
      }
      return value;
    }
    return {
      changeset: [...changeset],
      events: [...events],
      ...value,
    };
  }

  private eventsToEmit(
    value: unknown,
    accumulatorEvents: readonly unknown[],
    context: ContractProcessorContext,
  ): unknown[] {
    const rawEvents =
      this.isResultObject(value) && Object.hasOwn(value, 'events')
        ? value.events
        : accumulatorEvents;
    if (rawEvents === undefined) {
      return [];
    }
    if (!Array.isArray(rawEvents)) {
      return context.throwFatal('Compute result events must be a list');
    }
    return rawEvents.map((event) => this.eventObject(event, context));
  }

  private eventObject(
    event: unknown,
    context: ContractProcessorContext,
  ): BexResultObject {
    if (event === null || event === undefined) {
      return context.throwFatal(
        'Compute result events cannot contain undefined/null entries',
      );
    }
    if (!this.isResultObject(event)) {
      return context.throwFatal(
        'Compute result events must contain object entries',
      );
    }
    return event;
  }

  private isResultObject(value: unknown): value is BexResultObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private booleanProperty(
    node: BlueNode,
    key: string,
    fallback: boolean,
  ): boolean {
    const value = node.getProperties()?.[key]?.getValue();
    return typeof value === 'boolean' ? value : fallback;
  }

  private numericProperty(
    node: BlueNode,
    key: string,
    fallback: number,
  ): number {
    const value = node.getProperties()?.[key]?.getValue();
    if (typeof value === 'number') {
      return value;
    }
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return Number(value.toNumber());
    }
    return fallback;
  }

  private stringProperty(node: BlueNode, key: string): string | undefined {
    const value = node.getProperties()?.[key]?.getValue();
    return typeof value === 'string' ? value : undefined;
  }
}
