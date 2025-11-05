import { Blue, BlueNode } from '@blue-labs/language';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { PatchEngine, type PatchResult } from './patch-engine.js';
import { EmissionRegistry } from './emission-registry.js';
import { GasMeter } from './gas-meter.js';
import { ScopeRuntimeContext } from './scope-runtime-context.js';

export type DocumentUpdateData = PatchResult;

export class DocumentProcessingRuntime {
  private readonly patchEngine: PatchEngine;
  private readonly emissionRegistry = new EmissionRegistry();
  private readonly meter: GasMeter;
  private runTerminated = false;

  constructor(
    private readonly documentRef: BlueNode,
    private readonly blueRef: Blue,
  ) {
    this.patchEngine = new PatchEngine(this.documentRef);
    this.meter = new GasMeter(this.blueRef);
  }

  document(): BlueNode {
    return this.documentRef;
  }

  scopes(): Map<string, ScopeRuntimeContext> {
    return this.emissionRegistry.scopes();
  }

  scope(scopePath: string): ScopeRuntimeContext {
    return this.emissionRegistry.scope(scopePath);
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

  totalGas(): number {
    return this.meter.totalGas();
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
}
