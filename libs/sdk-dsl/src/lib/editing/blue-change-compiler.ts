import { BlueNode } from '@blue-labs/language';

import { diffEditingValues } from './doc-patch';
import { DocStructure } from './doc-structure';
import { cloneEditingJson } from '../internal/editing-json';
import type {
  BlueChangeBucket,
  BlueChangeGroup,
  BlueChangePlanSummary,
  BlueContractChange,
  ContractEntry,
  DocStructureInput,
  DocStructureSummary,
  EditingJsonValue,
} from './types';

export class BlueChangePlan implements BlueChangePlanSummary {
  readonly rootChanges;
  readonly contractAdds;
  readonly contractReplacements;
  readonly contractRemovals;
  readonly groups;
  readonly notes;

  constructor(summary: BlueChangePlanSummary) {
    this.rootChanges = summary.rootChanges;
    this.contractAdds = summary.contractAdds;
    this.contractReplacements = summary.contractReplacements;
    this.contractRemovals = summary.contractRemovals;
    this.groups = summary.groups;
    this.notes = summary.notes;
  }

  toSummaryJson(): BlueChangePlanSummary {
    return {
      rootChanges: this.rootChanges.map((change) => ({ ...change })),
      contractAdds: this.contractAdds.map(cloneContractChange),
      contractReplacements: this.contractReplacements.map(cloneContractChange),
      contractRemovals: this.contractRemovals.map(cloneContractChange),
      groups: this.groups.map((group) => ({
        ...group,
        changes: group.changes.map(cloneContractChange),
      })),
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
      lines.push(`- add ${change.key} [${change.bucket}]`);
    }

    lines.push('');
    lines.push(`Contract replacements: ${this.contractReplacements.length}`);
    for (const change of this.contractReplacements) {
      lines.push(`- replace ${change.key} [${change.bucket}]`);
    }

    lines.push('');
    lines.push(`Contract removals: ${this.contractRemovals.length}`);
    for (const change of this.contractRemovals) {
      lines.push(`- remove ${change.key} [${change.bucket}]`);
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

export class BlueChangeCompiler {
  static compile(
    beforeInput: DocStructureInput | DocStructure,
    afterInput: DocStructureInput | DocStructure,
  ): BlueChangePlan {
    const before = normalizeStructure(beforeInput);
    const after = normalizeStructure(afterInput);

    const rootChanges = diffEditingValues(
      buildRootDocument(before),
      buildRootDocument(after),
    );

    const beforeContracts = new Map(
      before.contracts.map((entry) => [entry.key, entry]),
    );
    const afterContracts = new Map(
      after.contracts.map((entry) => [entry.key, entry]),
    );
    const sectionIndex = buildSectionIndex(before, after);

    const contractAdds: BlueContractChange[] = [];
    const contractReplacements: BlueContractChange[] = [];
    const contractRemovals: BlueContractChange[] = [];

    const allKeys = new Set([
      ...beforeContracts.keys(),
      ...afterContracts.keys(),
    ]);

    for (const key of [...allKeys].sort()) {
      const beforeContract = beforeContracts.get(key);
      const afterContract = afterContracts.get(key);

      if (!beforeContract && afterContract) {
        contractAdds.push(
          createContractChange('add', afterContract, sectionIndex.get(key)),
        );
        continue;
      }

      if (beforeContract && !afterContract) {
        contractRemovals.push(
          createContractChange('remove', beforeContract, sectionIndex.get(key)),
        );
        continue;
      }

      if (
        beforeContract &&
        afterContract &&
        JSON.stringify(beforeContract.raw) !== JSON.stringify(afterContract.raw)
      ) {
        contractReplacements.push(
          createContractChange('replace', afterContract, sectionIndex.get(key)),
        );
      }
    }

    const groups = buildGroups([
      ...contractAdds,
      ...contractReplacements,
      ...contractRemovals,
    ]);
    const notes = buildNotes(
      rootChanges,
      contractAdds,
      contractReplacements,
      contractRemovals,
    );

    return new BlueChangePlan({
      rootChanges,
      contractAdds,
      contractReplacements,
      contractRemovals,
      groups,
      notes,
    });
  }
}

function normalizeStructure(
  input: DocStructureInput | DocStructure,
): DocStructure {
  if (input instanceof DocStructure) {
    return input;
  }

  if (input instanceof BlueNode) {
    return DocStructure.from(input);
  }

  return DocStructure.from(input as DocStructureSummary);
}

function buildRootDocument(structure: DocStructure): EditingJsonValue {
  const root: Record<string, EditingJsonValue> = {};
  if (structure.name != null) {
    root.name = structure.name;
  }
  if (structure.description != null) {
    root.description = structure.description;
  }
  if (structure.type != null) {
    root.type = structure.type;
  }

  for (const field of structure.fields) {
    const key = pointerPathToRootKey(field.path);
    if (field.rawValue !== undefined) {
      root[key] = field.rawValue;
    }
  }

  return root;
}

function pointerPathToRootKey(path: string): string {
  return path.slice(1).replaceAll('~1', '/').replaceAll('~0', '~');
}

function buildSectionIndex(
  before: DocStructure,
  after: DocStructure,
): Map<string, { key: string; title?: string }> {
  const index = new Map<string, { key: string; title?: string }>();

  for (const section of [...after.sections, ...before.sections]) {
    for (const contractKey of section.relatedContracts) {
      if (!index.has(contractKey)) {
        index.set(contractKey, { key: section.key, title: section.title });
      }
    }
  }

  return index;
}

function createContractChange(
  action: 'add' | 'replace' | 'remove',
  contract: ContractEntry,
  section: { key: string; title?: string } | undefined,
): BlueContractChange {
  return {
    action,
    key: contract.key,
    type: contract.type,
    sectionKey: section?.key,
    bucket: inferBucket(contract),
    contract: contract.raw,
  };
}

function inferBucket(contract: ContractEntry): BlueChangeBucket {
  const key = contract.key.toLowerCase();
  const type = contract.type?.toLowerCase() ?? '';

  if (contract.kind === 'channel') {
    return 'participants';
  }

  if (
    type.includes('paynote/') ||
    key.includes('capture') ||
    key.includes('reserve') ||
    key.includes('release') ||
    key.includes('mandate')
  ) {
    return 'paynote';
  }

  if (
    key.includes('ai') ||
    key.includes('llm') ||
    key.includes('provider') ||
    key.includes('prompt')
  ) {
    return 'ai';
  }

  if (
    type.includes('myos/') ||
    key.includes('permission') ||
    key.includes('session') ||
    key.includes('agency') ||
    key.includes('subscription') ||
    key.includes('admin')
  ) {
    return 'participants';
  }

  if (
    contract.kind === 'operation' ||
    contract.kind === 'operationImpl' ||
    contract.kind === 'workflow'
  ) {
    return 'logic';
  }

  return 'misc';
}

function buildGroups(
  changes: readonly BlueContractChange[],
): BlueChangeGroup[] {
  const groups = new Map<string, BlueChangeGroup>();

  for (const change of changes) {
    const key = change.sectionKey
      ? `section:${change.sectionKey}`
      : `bucket:${change.bucket}`;
    const existing = groups.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    groups.set(key, {
      key,
      title: change.sectionKey
        ? `Section ${change.sectionKey}`
        : `Bucket ${change.bucket}`,
      sectionKey: change.sectionKey,
      bucket: change.sectionKey ? undefined : change.bucket,
      changes: [change],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      changes: [...group.changes].sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildNotes(
  rootChanges: readonly unknown[],
  contractAdds: readonly BlueContractChange[],
  contractReplacements: readonly BlueContractChange[],
  contractRemovals: readonly BlueContractChange[],
): string[] {
  const notes: string[] = [];

  if (rootChanges.length > 0) {
    notes.push('Root-field changes are emitted as generic patch operations.');
  }
  if (
    contractAdds.length +
      contractReplacements.length +
      contractRemovals.length >
    0
  ) {
    notes.push('Contract changes are compiled as whole-contract atomic units.');
  }

  return notes;
}

function cloneContractChange(change: BlueContractChange): BlueContractChange {
  return {
    ...change,
    contract:
      change.contract == null ? undefined : cloneEditingJson(change.contract),
  };
}
