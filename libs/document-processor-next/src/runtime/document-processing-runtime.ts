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
  private readonly gasMeter: GasMeter;
  private runTerminated = false;

  constructor(
    private readonly documentRef: BlueNode,
    private readonly blueRef: Blue,
  ) {
    this.patchEngine = new PatchEngine(this.documentRef);
    this.gasMeter = new GasMeter(this.blueRef);
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
    this.gasMeter.add(amount);
  }

  blue(): Blue {
    return this.blueRef;
  }

  totalGas(): number {
    return this.gasMeter.totalGas();
  }

  chargeScopeEntry(scopePath: string): void {
    this.gasMeter.chargeScopeEntry(scopePath);
  }

  chargeInitialization(): void {
    this.gasMeter.chargeInitialization();
  }

  chargeChannelMatchAttempt(): void {
    this.gasMeter.chargeChannelMatchAttempt();
  }

  chargeHandlerOverhead(): void {
    this.gasMeter.chargeHandlerOverhead();
  }

  chargeBoundaryCheck(): void {
    this.gasMeter.chargeBoundaryCheck();
  }

  chargePatchAddOrReplace(value: BlueNode | null | undefined): void {
    this.gasMeter.chargePatchAddOrReplace(value ?? null);
  }

  chargePatchRemove(): void {
    this.gasMeter.chargePatchRemove();
  }

  chargeCascadeRouting(scopeCount: number): void {
    this.gasMeter.chargeCascadeRouting(scopeCount);
  }

  chargeEmitEvent(event: BlueNode | null | undefined): void {
    this.gasMeter.chargeEmitEvent(event ?? null);
  }

  chargeBridge(event?: BlueNode | null): void {
    void event;
    this.gasMeter.chargeBridge();
  }

  chargeDrainEvent(): void {
    this.gasMeter.chargeDrainEvent();
  }

  chargeCheckpointUpdate(): void {
    this.gasMeter.chargeCheckpointUpdate();
  }

  chargeTerminationMarker(): void {
    this.gasMeter.chargeTerminationMarker();
  }

  chargeLifecycleDelivery(): void {
    this.gasMeter.chargeLifecycleDelivery();
  }

  chargeFatalTerminationOverhead(): void {
    this.gasMeter.chargeFatalTerminationOverhead();
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
