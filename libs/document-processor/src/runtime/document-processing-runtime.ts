import { Blue, BlueNode } from '@blue-labs/language';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { PatchEngine, type PatchResult } from './patch-engine.js';
import { EmissionRegistry } from './emission-registry.js';
import { GasMeter } from './gas-meter.js';
import { ScopeRuntimeContext } from './scope-runtime-context.js';
import { TypeGeneralizationPlanner } from '../engine/generalization/type-generalization-planner.js';
import {
  BlueNodeTypeGraphProvider,
  type TypeGraphProvider,
} from '../engine/generalization/type-graph-provider.js';
import { TypeValidationMemo } from '../engine/generalization/type-validation-memo.js';
import { ProcessorTimer } from '../engine/processor-timing.js';

export type DocumentUpdateData = PatchResult;

export class DocumentProcessingRuntime {
  private readonly patchEngine: PatchEngine;
  private readonly emissionRegistry = new EmissionRegistry();
  private readonly meter: GasMeter;
  private readonly defaultTypeGraph: TypeGraphProvider;
  private readonly typeValidationMemo = new TypeValidationMemo();
  private runTerminated = false;

  constructor(
    private readonly documentRef: BlueNode,
    private readonly blueRef: Blue,
    private readonly timing = ProcessorTimer.disabled,
  ) {
    this.patchEngine = new PatchEngine(this.documentRef);
    this.meter = new GasMeter(this.blueRef);
    this.defaultTypeGraph = new BlueNodeTypeGraphProvider(this.blueRef);
  }

  document(): BlueNode {
    return this.documentRef;
  }

  scopes(): Map<string, ScopeRuntimeContext> {
    return this.emissionRegistry.scopes();
  }

  scope(scopePath: string): ScopeRuntimeContext {
    const context = this.emissionRegistry.scope(scopePath);
    if (scopePath === '/') {
      context.setEmbeddedDepth(0);
    }
    return context;
  }

  existingScope(scopePath: string): ScopeRuntimeContext | undefined {
    return this.emissionRegistry.existingScope(scopePath);
  }

  rootEmissions(): readonly BlueNode[] {
    return this.emissionRegistry.rootEmissions();
  }

  recordRootEmission(emission: BlueNode): void {
    this.emissionRegistry.recordRootEmission(emission);
  }

  addGas(amount: number): void {
    this.meter.add(amount);
  }

  blue(): Blue {
    return this.blueRef;
  }

  gasMeter(): GasMeter {
    return this.meter;
  }

  timer(): ProcessorTimer {
    return this.timing;
  }

  totalGas(): number {
    return this.meter.totalGas();
  }

  chargeScopeEntry(scopePath: string): void {
    this.meter.chargeScopeEntry(this.scope(scopePath).embeddedDepth());
  }

  setScopeEmbeddedDepth(scopePath: string, depth: number): void {
    this.scope(scopePath).setEmbeddedDepth(depth);
  }

  scopeEmbeddedDepth(scopePath: string): number {
    return this.scope(scopePath).embeddedDepth();
  }

  isRunTerminated(): boolean {
    return this.runTerminated;
  }

  markRunTerminated(): void {
    this.runTerminated = true;
  }

  isScopeTerminated(scopePath: string): boolean {
    return this.emissionRegistry.isScopeTerminated(scopePath);
  }

  directWrite(path: string, value: BlueNode | null): void {
    this.patchEngine.directWrite(path, value);
  }

  applyPatch(originScopePath: string, patch: JsonPatch): DocumentUpdateData {
    return this.patchEngine.applyPatch(originScopePath, patch);
  }

  applyPatchTransaction(
    originScopePath: string,
    patch: JsonPatch,
    generatedPatches: readonly JsonPatch[],
  ): readonly DocumentUpdateData[] {
    const preview = this.timing.measure('patch.clonePreview', () =>
      this.documentRef.clone(),
    );
    const previewEngine = new PatchEngine(preview);
    const updates = this.timing.measure('patch.applyTransaction', () => [
      previewEngine.applyPatch(originScopePath, patch),
      ...generatedPatches.map((generatedPatch) =>
        previewEngine.applyPatch(originScopePath, generatedPatch),
      ),
    ]);
    this.timing.measure('patch.commitPreview', () =>
      replaceNodeContent(this.documentRef, preview),
    );
    return updates;
  }

  planPatch(
    originScopePath: string,
    patch: JsonPatch,
    typeGraph?: TypeGraphProvider | null,
  ): readonly JsonPatch[] {
    return this.timing.measure(
      'patch.restoreTypeSoundness',
      () =>
        new TypeGeneralizationPlanner(
          typeGraph ?? this.defaultTypeGraph,
          this.typeValidationMemo,
        ).planPatch(originScopePath, this.documentRef, patch).generatedPatches,
      { path: patch.path, op: patch.op },
    );
  }
}

function replaceNodeContent(target: BlueNode, source: BlueNode): void {
  const next = source.clone() as unknown as Record<string, unknown>;
  const current = target as unknown as Record<string, unknown>;
  for (const key of [
    'name',
    'description',
    'type',
    'itemType',
    'keyType',
    'valueType',
    'value',
    'items',
    'properties',
    'contracts',
    'blueId',
    'schema',
    'mergePolicy',
    'previousBlueId',
    'position',
    'blue',
    'inlineValue',
  ]) {
    current[key] = next[key];
  }
}
