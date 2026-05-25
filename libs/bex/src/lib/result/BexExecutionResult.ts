import { BlueNode } from '@blue-labs/language';
import { BexBlueOutputOptions, BexValue, BexValues } from '../value/BexValues';

export interface BexPatchEntry {
  op: 'add' | 'replace' | 'remove';
  path: string;
  val?: unknown;
}

export class BexChangeset {
  constructor(private readonly entries: BexPatchEntry[] = []) {}

  public append(entry: BexPatchEntry): void {
    this.entries.push(entry);
  }

  public toSimple(): BexPatchEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  public entriesSnapshot(): BexPatchEntry[] {
    return this.toSimple();
  }

  public asValue(): BexValue {
    return BexValues.fromSimple(this.toSimple());
  }
}

export class BexEvents {
  constructor(private readonly entries: unknown[] = []) {}

  public append(event: unknown): void {
    this.entries.push(event);
  }

  public toSimple(): unknown[] {
    return [...this.entries];
  }

  public asValue(): BexValue {
    return BexValues.fromSimple(this.toSimple());
  }
}

export class BexMetrics {
  public expressionEvaluations = 0;
  public statementExecutions = 0;
  public functionCalls = 0;
  public documentReads = 0;
  public eventReads = 0;
  public stepsReads = 0;
  public currentContractReads = 0;
  public resultValueReads = 0;
  public patchAppends = 0;
  public eventAppends = 0;

  public snapshot(): BexMetricsSnapshot {
    return {
      expressionEvaluations: this.expressionEvaluations,
      statementExecutions: this.statementExecutions,
      functionCalls: this.functionCalls,
      documentReads: this.documentReads,
      eventReads: this.eventReads,
      stepsReads: this.stepsReads,
      currentContractReads: this.currentContractReads,
      resultValueReads: this.resultValueReads,
      patchAppends: this.patchAppends,
      eventAppends: this.eventAppends,
    };
  }
}

export interface BexMetricsSnapshot {
  readonly expressionEvaluations: number;
  readonly statementExecutions: number;
  readonly functionCalls: number;
  readonly documentReads: number;
  readonly eventReads: number;
  readonly stepsReads: number;
  readonly currentContractReads: number;
  readonly resultValueReads: number;
  readonly patchAppends: number;
  readonly eventAppends: number;
}

export class BexExecutionResult {
  constructor(
    public readonly value: BexValue,
    public readonly changeset: BexChangeset,
    public readonly events: BexEvents,
    public readonly gasUsed: number,
    public readonly metrics = new BexMetrics(),
  ) {}

  public valueAsBlueNodeStrict(options?: BexBlueOutputOptions): BlueNode {
    return this.value.toBlueNodeStrict(options);
  }
}
