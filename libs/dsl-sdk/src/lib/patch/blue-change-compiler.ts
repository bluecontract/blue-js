import { BlueNode } from '@blue-labs/language';
import {
  escapePointerSegment,
  removePointer,
  setPointer,
} from '../core/pointers.js';
import { toOfficialJson } from '../core/serialization.js';
import type { JsonObject, JsonValue } from '../core/types.js';
import {
  DocStructure,
  type DocContractEntry,
} from '../structure/doc-structure.js';
import { diffJsonDocuments, type JsonPatchOperation } from './diff.js';

export interface BlueContractChange {
  readonly op: 'add' | 'replace' | 'remove';
  readonly key: string;
  readonly contractKey: string;
  readonly bucket: string;
  readonly sectionKey: string;
  readonly contract?: JsonObject;
  readonly before?: JsonObject;
  readonly after?: JsonObject;
  readonly beforeFingerprint?: string;
  readonly afterFingerprint?: string;
}

export interface BlueSectionChangeGroup {
  readonly sectionKey: string;
  readonly contractKeys: readonly string[];
  readonly changes: readonly BlueContractChange[];
}

export interface BlueChangeGroup {
  readonly key: string;
  readonly title: string;
  readonly sectionKey?: string;
  readonly bucket?: string;
  readonly changes: readonly BlueContractChange[];
}

export interface BlueChangePlanSummary {
  readonly rootChanges: readonly JsonPatchOperation[];
  readonly contractChanges: readonly BlueContractChange[];
  readonly sectionChanges: readonly BlueSectionChangeGroup[];
  readonly patchOperations: readonly JsonPatchOperation[];
  readonly contractAdds: readonly BlueContractChange[];
  readonly contractReplacements: readonly BlueContractChange[];
  readonly contractRemovals: readonly BlueContractChange[];
  readonly groups: readonly BlueChangeGroup[];
  readonly notes: readonly string[];
}

type ExistingDocument = BlueNode | JsonObject;

function toJsonDocument(document: ExistingDocument): JsonObject {
  if (document instanceof BlueNode) {
    return toOfficialJson(document);
  }
  return structuredClone(document);
}

function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function sortedKeys(object: JsonObject): string[] {
  return Object.keys(object).sort((left, right) => left.localeCompare(right));
}

function stableStringify(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry as JsonValue)).join(',')}]`;
  }
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  const object = value as JsonObject;
  return `{${sortedKeys(object)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify(object[key] as JsonValue)}`,
    )
    .join(',')}}`;
}

function contractPointerPath(key: string): string {
  return `/contracts/${escapePointerSegment(key)}`;
}

function removeRootKey(document: JsonObject, key: string): JsonObject {
  const copy = structuredClone(document);
  delete copy[key];
  return copy;
}

function inferSectionBucket(contract: DocContractEntry): string {
  const key = contract.key.toLowerCase();
  const typeAlias = (contract.type ?? '').toLowerCase();
  if (contract.kind === 'channel') {
    return 'participants';
  }
  if (key.includes('ai') || typeAlias.includes('/ai') || key.includes('llm')) {
    return 'ai';
  }
  if (typeAlias.startsWith('paynote/')) {
    return 'paynote';
  }
  if (
    key.includes('payment') ||
    key.includes('reserve') ||
    key.includes('release') ||
    key.includes('capture') ||
    key.includes('voucher')
  ) {
    return 'payments';
  }
  if (
    contract.kind === 'operation' ||
    contract.kind === 'operationImpl' ||
    contract.kind === 'workflow' ||
    contract.kind === 'policy'
  ) {
    return 'logic';
  }
  return 'misc';
}

function inferBucket(contractKey: string, contract?: DocContractEntry): string {
  if (contract) {
    return inferSectionBucket(contract);
  }
  return contractKey.toLowerCase().includes('channel')
    ? 'participants'
    : 'misc';
}

function contractsByKey(
  contracts: readonly DocContractEntry[],
): Record<string, DocContractEntry> {
  const indexed: Record<string, DocContractEntry> = {};
  for (const contract of contracts) {
    indexed[contract.key] = contract;
  }
  return indexed;
}

function resolveSectionKey(
  beforeContract: DocContractEntry | undefined,
  afterContract: DocContractEntry | undefined,
  bucket: string,
): string {
  const afterSections = afterContract?.sectionKeys ?? [];
  if (afterSections.length > 0) {
    return [...afterSections].sort((left, right) =>
      left.localeCompare(right),
    )[0] as string;
  }
  const beforeSections = beforeContract?.sectionKeys ?? [];
  if (beforeSections.length > 0) {
    return [...beforeSections].sort((left, right) =>
      left.localeCompare(right),
    )[0] as string;
  }
  return bucket;
}

export function compileRootChanges(
  beforeDocument: ExistingDocument,
  afterDocument: ExistingDocument,
): JsonPatchOperation[] {
  const beforeJson = toJsonDocument(beforeDocument);
  const afterJson = toJsonDocument(afterDocument);
  const beforeComparable = removeRootKey(beforeJson, 'contracts');
  const afterComparable = removeRootKey(afterJson, 'contracts');
  return diffJsonDocuments(beforeComparable, afterComparable);
}

export function compileContractChanges(
  beforeDocument: ExistingDocument,
  afterDocument: ExistingDocument,
): BlueContractChange[] {
  const beforeJson = toJsonDocument(beforeDocument);
  const afterJson = toJsonDocument(afterDocument);
  const beforeContractsRoot =
    asJsonObject(beforeJson.contracts as JsonValue) ?? {};
  const afterContractsRoot =
    asJsonObject(afterJson.contracts as JsonValue) ?? {};
  const contractKeys = [
    ...new Set([
      ...sortedKeys(beforeContractsRoot),
      ...sortedKeys(afterContractsRoot),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  const beforeStructure = DocStructure.from(beforeJson);
  const afterStructure = DocStructure.from(afterJson);
  const beforeContracts = contractsByKey(beforeStructure.contracts);
  const afterContracts = contractsByKey(afterStructure.contracts);

  const changes: BlueContractChange[] = [];
  for (const contractKey of contractKeys) {
    const beforeContractRaw = asJsonObject(
      beforeContractsRoot[contractKey] as JsonValue,
    );
    const afterContractRaw = asJsonObject(
      afterContractsRoot[contractKey] as JsonValue,
    );
    const beforeContract = beforeContracts[contractKey];
    const afterContract = afterContracts[contractKey];
    const bucket = inferBucket(contractKey, afterContract ?? beforeContract);
    const sectionKey = resolveSectionKey(beforeContract, afterContract, bucket);

    if (!beforeContractRaw && afterContractRaw) {
      changes.push({
        op: 'add',
        key: contractKey,
        contractKey,
        bucket,
        sectionKey,
        contract: structuredClone(afterContractRaw),
        after: structuredClone(afterContractRaw),
        afterFingerprint: afterContract?.fingerprint,
      });
      continue;
    }
    if (beforeContractRaw && !afterContractRaw) {
      changes.push({
        op: 'remove',
        key: contractKey,
        contractKey,
        bucket,
        sectionKey,
        contract: structuredClone(beforeContractRaw),
        before: structuredClone(beforeContractRaw),
        beforeFingerprint: beforeContract?.fingerprint,
      });
      continue;
    }
    if (!beforeContractRaw || !afterContractRaw) {
      continue;
    }

    if (
      stableStringify(beforeContractRaw) === stableStringify(afterContractRaw)
    ) {
      continue;
    }
    changes.push({
      op: 'replace',
      key: contractKey,
      contractKey,
      bucket,
      sectionKey,
      contract: structuredClone(afterContractRaw),
      before: structuredClone(beforeContractRaw),
      after: structuredClone(afterContractRaw),
      beforeFingerprint: beforeContract?.fingerprint,
      afterFingerprint: afterContract?.fingerprint,
    });
  }
  return changes.sort((left, right) => {
    if (left.sectionKey !== right.sectionKey) {
      return left.sectionKey.localeCompare(right.sectionKey);
    }
    if (left.contractKey !== right.contractKey) {
      return left.contractKey.localeCompare(right.contractKey);
    }
    const opOrder = { remove: 1, add: 2, replace: 3 } as const;
    return opOrder[left.op] - opOrder[right.op];
  });
}

function compileSectionGroups(
  contractChanges: readonly BlueContractChange[],
): BlueSectionChangeGroup[] {
  const grouped: Record<string, BlueContractChange[]> = {};
  for (const change of contractChanges) {
    if (!grouped[change.sectionKey]) {
      grouped[change.sectionKey] = [];
    }
    grouped[change.sectionKey]?.push(change);
  }
  return Object.keys(grouped)
    .sort((left, right) => left.localeCompare(right))
    .map((sectionKey) => {
      const changes = (grouped[sectionKey] ?? []).sort((left, right) => {
        const byContractKey = left.contractKey.localeCompare(right.contractKey);
        if (byContractKey !== 0) {
          return byContractKey;
        }
        const opOrder = { remove: 1, add: 2, replace: 3 } as const;
        return opOrder[left.op] - opOrder[right.op];
      });
      return {
        sectionKey,
        contractKeys: [
          ...new Set(changes.map((change) => change.contractKey)),
        ].sort((left, right) => left.localeCompare(right)),
        changes,
      };
    });
}

function buildChangeGroups(
  contractChanges: readonly BlueContractChange[],
): BlueChangeGroup[] {
  const grouped = new Map<string, BlueChangeGroup>();

  for (const change of contractChanges) {
    const isSectionGroup = change.sectionKey !== change.bucket;
    const key = isSectionGroup
      ? `section:${change.sectionKey}`
      : `bucket:${change.bucket}`;

    const existing = grouped.get(key);
    if (existing) {
      (existing.changes as BlueContractChange[]).push(change);
      continue;
    }

    grouped.set(key, {
      key,
      title: isSectionGroup
        ? `Section ${change.sectionKey}`
        : `Bucket ${change.bucket}`,
      ...(isSectionGroup
        ? { sectionKey: change.sectionKey }
        : { bucket: change.bucket }),
      changes: [change],
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      changes: [...group.changes].sort((left, right) =>
        left.contractKey.localeCompare(right.contractKey),
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildPlanNotes(
  rootChanges: readonly JsonPatchOperation[],
  contractChanges: readonly BlueContractChange[],
): string[] {
  const notes: string[] = [];
  if (rootChanges.length > 0) {
    notes.push('Root-field changes are emitted as generic patch operations.');
  }
  if (contractChanges.length > 0) {
    notes.push('Contract changes are emitted as whole-contract atomic units.');
  }
  return notes;
}

function compilePatchOperations(
  beforeDocument: ExistingDocument,
  afterDocument: ExistingDocument,
  rootChanges: readonly JsonPatchOperation[],
  contractChanges: readonly BlueContractChange[],
): JsonPatchOperation[] {
  const beforeJson = toJsonDocument(beforeDocument);
  const afterJson = toJsonDocument(afterDocument);
  const hasContractsRoot = Boolean(
    asJsonObject(beforeJson.contracts as JsonValue),
  );
  const hasNextContractsRoot = Boolean(
    asJsonObject(afterJson.contracts as JsonValue),
  );

  const operations: JsonPatchOperation[] = [...rootChanges];
  const contractAddsOrReplaces = contractChanges.filter(
    (change) => change.op === 'add' || change.op === 'replace',
  );
  if (!hasContractsRoot && contractAddsOrReplaces.length > 0) {
    operations.push({
      op: 'add',
      path: '/contracts',
      val: {},
    });
  }

  const sortedRemovals = contractChanges
    .filter((change) => change.op === 'remove')
    .sort((left, right) => left.contractKey.localeCompare(right.contractKey));
  for (const change of sortedRemovals) {
    operations.push({
      op: 'remove',
      path: contractPointerPath(change.contractKey),
    });
  }
  if (
    hasContractsRoot &&
    !hasNextContractsRoot &&
    sortedRemovals.length > 0 &&
    contractAddsOrReplaces.length === 0
  ) {
    operations.push({
      op: 'remove',
      path: '/contracts',
    });
  }

  const sortedAddsOrReplaces = contractChanges
    .filter((change) => change.op !== 'remove')
    .sort((left, right) => left.contractKey.localeCompare(right.contractKey));
  for (const change of sortedAddsOrReplaces) {
    const path = contractPointerPath(change.contractKey);
    operations.push({
      op: change.op,
      path,
      val: structuredClone(change.after ?? {}),
    });
  }
  return operations;
}

function cloneContractChange(change: BlueContractChange): BlueContractChange {
  return {
    ...change,
    contract:
      change.contract === undefined
        ? undefined
        : structuredClone(change.contract),
    before:
      change.before === undefined ? undefined : structuredClone(change.before),
    after:
      change.after === undefined ? undefined : structuredClone(change.after),
  };
}

function clonePatchOperation(
  operation: JsonPatchOperation,
): JsonPatchOperation {
  if (operation.op === 'remove') {
    return { ...operation };
  }
  return {
    ...operation,
    val: structuredClone(operation.val),
  };
}

function cloneSectionChangeGroup(
  group: BlueSectionChangeGroup,
): BlueSectionChangeGroup {
  return {
    sectionKey: group.sectionKey,
    contractKeys: [...group.contractKeys],
    changes: group.changes.map(cloneContractChange),
  };
}

function cloneChangeGroup(group: BlueChangeGroup): BlueChangeGroup {
  return {
    ...group,
    changes: group.changes.map(cloneContractChange),
  };
}

export class BlueChangePlan implements BlueChangePlanSummary {
  readonly rootChanges: readonly JsonPatchOperation[];
  readonly contractChanges: readonly BlueContractChange[];
  readonly sectionChanges: readonly BlueSectionChangeGroup[];
  readonly patchOperations: readonly JsonPatchOperation[];
  readonly contractAdds: readonly BlueContractChange[];
  readonly contractReplacements: readonly BlueContractChange[];
  readonly contractRemovals: readonly BlueContractChange[];
  readonly groups: readonly BlueChangeGroup[];
  readonly notes: readonly string[];

  constructor(summary: BlueChangePlanSummary) {
    this.rootChanges = summary.rootChanges.map(clonePatchOperation);
    this.contractChanges = summary.contractChanges.map(cloneContractChange);
    this.sectionChanges = summary.sectionChanges.map(cloneSectionChangeGroup);
    this.patchOperations = summary.patchOperations.map(clonePatchOperation);
    this.contractAdds = summary.contractAdds.map(cloneContractChange);
    this.contractReplacements =
      summary.contractReplacements.map(cloneContractChange);
    this.contractRemovals = summary.contractRemovals.map(cloneContractChange);
    this.groups = summary.groups.map(cloneChangeGroup);
    this.notes = [...summary.notes];
  }

  toSummaryJson(): BlueChangePlanSummary {
    return {
      rootChanges: this.rootChanges.map(clonePatchOperation),
      contractChanges: this.contractChanges.map(cloneContractChange),
      sectionChanges: this.sectionChanges.map(cloneSectionChangeGroup),
      patchOperations: this.patchOperations.map(clonePatchOperation),
      contractAdds: this.contractAdds.map(cloneContractChange),
      contractReplacements: this.contractReplacements.map(cloneContractChange),
      contractRemovals: this.contractRemovals.map(cloneContractChange),
      groups: this.groups.map(cloneChangeGroup),
      notes: [...this.notes],
    };
  }

  toPromptText(): string {
    const lines: string[] = [];
    lines.push(`Root changes: ${this.rootChanges.length}`);
    for (const change of this.rootChanges) {
      lines.push(`- ${change.op} ${change.path}`);
    }

    lines.push('');
    lines.push(`Contract adds: ${this.contractAdds.length}`);
    for (const change of this.contractAdds) {
      lines.push(`- add ${change.contractKey} [${change.bucket}]`);
    }

    lines.push('');
    lines.push(`Contract replacements: ${this.contractReplacements.length}`);
    for (const change of this.contractReplacements) {
      lines.push(`- replace ${change.contractKey} [${change.bucket}]`);
    }

    lines.push('');
    lines.push(`Contract removals: ${this.contractRemovals.length}`);
    for (const change of this.contractRemovals) {
      lines.push(`- remove ${change.contractKey} [${change.bucket}]`);
    }

    lines.push('');
    lines.push(`Groups: ${this.groups.length}`);
    for (const group of this.groups) {
      lines.push(`- ${group.key}: ${group.title} (${group.changes.length})`);
    }

    if (this.notes.length > 0) {
      lines.push('');
      lines.push('Notes:');
      for (const note of this.notes) {
        lines.push(`- ${note}`);
      }
    }

    return lines.join('\n');
  }
}

export function applyBlueChangePlan(
  beforeDocument: ExistingDocument,
  plan: BlueChangePlanSummary,
): JsonObject {
  const next = toJsonDocument(beforeDocument);
  for (const operation of plan.patchOperations) {
    if (operation.op === 'remove') {
      removePointer(next, operation.path);
      continue;
    }
    setPointer(next, operation.path, structuredClone(operation.val));
  }
  return next;
}

export class BlueChangeCompiler {
  static compile(
    beforeDocument: ExistingDocument,
    afterDocument: ExistingDocument,
  ): BlueChangePlan {
    const rootChanges = compileRootChanges(beforeDocument, afterDocument);
    const contractChanges = compileContractChanges(
      beforeDocument,
      afterDocument,
    );
    const sectionChanges = compileSectionGroups(contractChanges);
    const contractAdds = contractChanges.filter(
      (change) => change.op === 'add',
    );
    const contractReplacements = contractChanges.filter(
      (change) => change.op === 'replace',
    );
    const contractRemovals = contractChanges.filter(
      (change) => change.op === 'remove',
    );
    const groups = buildChangeGroups(contractChanges);
    const notes = buildPlanNotes(rootChanges, contractChanges);
    const patchOperations = compilePatchOperations(
      beforeDocument,
      afterDocument,
      rootChanges,
      contractChanges,
    );
    return new BlueChangePlan({
      rootChanges,
      contractChanges,
      sectionChanges,
      patchOperations,
      contractAdds,
      contractReplacements,
      contractRemovals,
      groups,
      notes,
    });
  }
}
