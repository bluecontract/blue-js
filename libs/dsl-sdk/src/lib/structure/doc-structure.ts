import { BlueNode } from '@blue-labs/language';
import { escapePointerSegment } from '../core/pointers.js';
import { toOfficialJson } from '../core/serialization.js';
import type { JsonObject, JsonValue } from '../core/types.js';

export type DocFieldKind =
  | 'primitive'
  | 'object'
  | 'array'
  | 'typed-node-like object';

export interface DocFieldEntry {
  readonly path: string;
  readonly value: JsonValue;
  readonly kind: DocFieldKind;
  readonly valuePreview: string;
}

export type DocContractKind =
  | 'channel'
  | 'operation'
  | 'operationImpl'
  | 'workflow'
  | 'section'
  | 'policy'
  | 'other';

export interface DocContractEntry {
  readonly key: string;
  readonly type?: string;
  readonly kind: DocContractKind;
  readonly raw: JsonObject;
  readonly fingerprint: string;
  readonly sectionKeys: readonly string[];
  readonly channelBinding?: string;
  readonly requestType?: string;
  readonly operationTarget?: string;
  readonly matcherType?: string;
}

export interface DocSectionEntry {
  readonly key: string;
  readonly title: string;
  readonly summary?: string;
  readonly relatedFields: readonly string[];
  readonly relatedContracts: readonly string[];
}

export interface DocPolicyEntry {
  readonly key: string;
  readonly type?: string;
  readonly summary: string;
}

export interface DocStructureSummary {
  readonly name?: string;
  readonly description?: string;
  readonly type?: string;
  readonly fields: readonly DocFieldEntry[];
  readonly contracts: readonly DocContractEntry[];
  readonly sections: readonly DocSectionEntry[];
  readonly policies: readonly DocPolicyEntry[];
  readonly unclassifiedContracts: readonly DocContractEntry[];
}

const RESERVED_ROOT_KEYS = new Set([
  'name',
  'description',
  'type',
  'contracts',
  'policies',
]);

function isDocStructureSummary(
  value: JsonObject | DocStructureSummary,
): value is DocStructureSummary {
  return (
    Array.isArray((value as DocStructureSummary).fields) &&
    Array.isArray((value as DocStructureSummary).contracts) &&
    Array.isArray((value as DocStructureSummary).sections) &&
    Array.isArray((value as DocStructureSummary).policies) &&
    Array.isArray((value as DocStructureSummary).unclassifiedContracts)
  );
}

function cloneSummary(summary: DocStructureSummary): DocStructureSummary {
  return structuredClone(summary);
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

function fieldKind(value: JsonValue): DocFieldKind {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (!value || typeof value !== 'object') {
    return 'primitive';
  }
  if (typeof (value as JsonObject).type === 'string') {
    return 'typed-node-like object';
  }
  return 'object';
}

function valuePreview(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  const object = value as JsonObject;
  if (typeof object.type === 'string') {
    return `<${object.type}>`;
  }
  return `{${Object.keys(object).length} keys}`;
}

function walkFields(
  value: JsonValue,
  pointer: string,
  output: DocFieldEntry[],
): void {
  const kind = fieldKind(value);
  if (
    kind === 'primitive' ||
    kind === 'array' ||
    kind === 'typed-node-like object'
  ) {
    output.push({
      path: pointer,
      value: structuredClone(value) as JsonValue,
      kind,
      valuePreview: valuePreview(value),
    });
    return;
  }

  const object = value as JsonObject;
  const keys = sortedKeys(object);
  if (keys.length === 0) {
    output.push({
      path: pointer,
      value: {},
      kind: 'object',
      valuePreview: '{0 keys}',
    });
    return;
  }
  for (const key of keys) {
    walkFields(
      object[key] as JsonValue,
      `${pointer}/${escapePointerSegment(key)}`,
      output,
    );
  }
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

function fingerprint(value: JsonValue): string {
  const serialized = stableStringify(value);
  let hashA = 2166136261;
  let hashB = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 16777619);
    hashB ^= code * 97;
    hashB = Math.imul(hashB, 16777619);
  }
  const partA = (hashA >>> 0).toString(16).padStart(8, '0');
  const partB = (hashB >>> 0).toString(16).padStart(8, '0');
  return `${partA}${partB}${partA}${partB}${partA}${partB}${partA}${partB}`;
}

function contractKind(typeAlias: string | undefined): DocContractKind {
  if (!typeAlias) {
    return 'other';
  }
  if (typeAlias === 'Conversation/Document Section') {
    return 'section';
  }
  if (typeAlias.includes('Policy')) {
    return 'policy';
  }
  if (typeAlias.includes('Channel')) {
    return 'channel';
  }
  if (typeAlias.includes('Sequential Workflow Operation')) {
    return 'operationImpl';
  }
  if (
    typeAlias.includes('Operation') ||
    typeAlias.includes('Change Operation')
  ) {
    return 'operation';
  }
  if (typeAlias.includes('Workflow')) {
    return 'workflow';
  }
  return 'other';
}

function sectionMembershipMap(
  sections: readonly DocSectionEntry[],
): Record<string, Set<string>> {
  const memberships: Record<string, Set<string>> = {};
  for (const section of sections) {
    for (const contractKey of section.relatedContracts) {
      if (!memberships[contractKey]) {
        memberships[contractKey] = new Set<string>();
      }
      memberships[contractKey]?.add(section.key);
    }
  }
  return memberships;
}

function policySummary(policyRaw: JsonObject): string {
  const parts: string[] = [];
  const requireSectionChanges = policyRaw.requireSectionChanges;
  if (typeof requireSectionChanges === 'boolean') {
    parts.push(`requireSectionChanges=${String(requireSectionChanges)}`);
  }
  if (parts.length === 0) {
    return `keys=${Object.keys(policyRaw).length}`;
  }
  return parts.join(', ');
}

function promptHeader(name?: string): string {
  return `Document: ${name ?? '(unnamed)'}`;
}

export class DocStructure implements DocStructureSummary {
  readonly name?: string;
  readonly description?: string;
  readonly type?: string;
  readonly fields: readonly DocFieldEntry[];
  readonly contracts: readonly DocContractEntry[];
  readonly sections: readonly DocSectionEntry[];
  readonly policies: readonly DocPolicyEntry[];
  readonly unclassifiedContracts: readonly DocContractEntry[];
  readonly unknownContracts: readonly DocContractEntry[];

  private constructor(summary: DocStructureSummary) {
    const cloned = cloneSummary(summary);
    this.name = cloned.name;
    this.description = cloned.description;
    this.type = cloned.type;
    this.fields = cloned.fields;
    this.contracts = cloned.contracts;
    this.sections = cloned.sections;
    this.policies = cloned.policies;
    this.unclassifiedContracts = cloned.unclassifiedContracts;
    this.unknownContracts = cloned.unclassifiedContracts;
  }

  static from(
    document: BlueNode | JsonObject | DocStructureSummary | DocStructure,
  ): DocStructure {
    if (document instanceof DocStructure) {
      return document;
    }
    if (!(document instanceof BlueNode) && isDocStructureSummary(document)) {
      return new DocStructure(document);
    }
    const json =
      document instanceof BlueNode
        ? toOfficialJson(document)
        : (structuredClone(document) as JsonObject);

    const fields: DocFieldEntry[] = [];
    for (const key of sortedKeys(json)) {
      if (RESERVED_ROOT_KEYS.has(key)) {
        continue;
      }
      walkFields(
        json[key] as JsonValue,
        `/${escapePointerSegment(key)}`,
        fields,
      );
    }

    const contractsRoot = asJsonObject(json.contracts as JsonValue) ?? {};
    const preSectionContracts: Array<{
      key: string;
      type?: string;
      kind: DocContractKind;
      raw: JsonObject;
    }> = [];
    for (const key of sortedKeys(contractsRoot)) {
      const raw = asJsonObject(contractsRoot[key] as JsonValue) ?? {};
      const type = typeof raw.type === 'string' ? raw.type : undefined;
      preSectionContracts.push({
        key,
        type,
        kind: contractKind(type),
        raw: structuredClone(raw),
      });
    }

    const sections: DocSectionEntry[] = preSectionContracts
      .filter((contract) => contract.kind === 'section')
      .map((sectionContract) => {
        const title =
          typeof sectionContract.raw.title === 'string'
            ? sectionContract.raw.title
            : sectionContract.key;
        const summary =
          typeof sectionContract.raw.summary === 'string'
            ? sectionContract.raw.summary
            : undefined;
        const relatedFields = Array.isArray(sectionContract.raw.relatedFields)
          ? sectionContract.raw.relatedFields.filter(
              (entry): entry is string => typeof entry === 'string',
            )
          : [];
        const relatedContracts = Array.isArray(
          sectionContract.raw.relatedContracts,
        )
          ? sectionContract.raw.relatedContracts.filter(
              (entry): entry is string => typeof entry === 'string',
            )
          : [];
        return {
          key: sectionContract.key,
          title,
          summary,
          relatedFields: [...new Set(relatedFields)].sort((left, right) =>
            left.localeCompare(right),
          ),
          relatedContracts: [...new Set(relatedContracts)].sort((left, right) =>
            left.localeCompare(right),
          ),
        };
      })
      .sort((left, right) => left.key.localeCompare(right.key));

    const memberships = sectionMembershipMap(sections);
    const contracts: DocContractEntry[] = preSectionContracts.map(
      (contract) => {
        const requestRoot = asJsonObject(contract.raw.request as JsonValue);
        const eventRoot = asJsonObject(contract.raw.event as JsonValue);
        return {
          key: contract.key,
          type: contract.type,
          kind: contract.kind,
          raw: structuredClone(contract.raw),
          fingerprint: fingerprint(contract.raw),
          sectionKeys: [
            ...(memberships[contract.key] ?? new Set<string>()),
          ].sort((left, right) => left.localeCompare(right)),
          channelBinding:
            typeof contract.raw.channel === 'string'
              ? contract.raw.channel
              : undefined,
          requestType:
            typeof requestRoot?.type === 'string'
              ? requestRoot.type
              : undefined,
          operationTarget:
            typeof contract.raw.operation === 'string'
              ? contract.raw.operation
              : undefined,
          matcherType:
            typeof eventRoot?.type === 'string' ? eventRoot.type : undefined,
        };
      },
    );

    const policies: DocPolicyEntry[] = [
      ...contracts
        .filter((contract) => contract.kind === 'policy')
        .map((contract) => ({
          key: contract.key,
          type: contract.type,
          summary: policySummary(contract.raw),
        })),
    ];
    const rootPolicies = asJsonObject(json.policies as JsonValue);
    if (rootPolicies) {
      for (const key of sortedKeys(rootPolicies)) {
        const policyRaw = asJsonObject(rootPolicies[key] as JsonValue) ?? {};
        policies.push({
          key,
          type: typeof policyRaw.type === 'string' ? policyRaw.type : undefined,
          summary: policySummary(policyRaw),
        });
      }
    }

    const sectionContractKeys = new Set(sections.map((section) => section.key));
    const unclassifiedContracts = contracts.filter(
      (contract) => !sectionContractKeys.has(contract.key),
    );

    return new DocStructure({
      name: typeof json.name === 'string' ? json.name : undefined,
      description:
        typeof json.description === 'string' ? json.description : undefined,
      type: typeof json.type === 'string' ? json.type : undefined,
      fields,
      contracts,
      sections,
      policies: policies.sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
      unclassifiedContracts,
    });
  }

  getContract(key: string): DocContractEntry | undefined {
    return this.contracts.find((contract) => contract.key === key);
  }

  getSection(key: string): DocSectionEntry | undefined {
    return this.sections.find((section) => section.key === key);
  }

  toSummaryJson(): DocStructureSummary {
    return cloneSummary({
      name: this.name,
      description: this.description,
      type: this.type,
      fields: this.fields,
      contracts: this.contracts,
      sections: this.sections,
      policies: this.policies,
      unclassifiedContracts: this.unclassifiedContracts,
    });
  }

  toPromptText(): string {
    const lines: string[] = [promptHeader(this.name)];
    lines.push(`Type: ${this.type ?? 'n/a'}`);
    if (this.description) {
      lines.push(`Description: ${this.description}`);
    }

    lines.push('');
    lines.push(`Fields (${this.fields.length})`);
    if (this.fields.length === 0) {
      lines.push('- none');
    } else {
      for (const field of this.fields) {
        lines.push(
          `- ${field.path} [${field.kind}] = ${field.valuePreview} (${field.valuePreview.length} chars preview)`,
        );
      }
    }

    lines.push('');
    lines.push(`Contracts (${this.contracts.length})`);
    if (this.contracts.length === 0) {
      lines.push('- none');
    } else {
      for (const contract of this.contracts) {
        const metadata: string[] = [];
        if (contract.channelBinding) {
          metadata.push(`channel=${contract.channelBinding}`);
        }
        if (contract.requestType) {
          metadata.push(`request=${contract.requestType}`);
        }
        if (contract.operationTarget) {
          metadata.push(`operation=${contract.operationTarget}`);
        }
        if (contract.matcherType) {
          metadata.push(`matcher=${contract.matcherType}`);
        }
        if (contract.sectionKeys.length > 0) {
          metadata.push(`sections=${contract.sectionKeys.join(',')}`);
        }
        lines.push(
          `- ${contract.key} [${contract.kind}] ${contract.type ?? 'unknown'}${metadata.length > 0 ? ` | ${metadata.join(' | ')}` : ''}`,
        );
      }
    }

    lines.push('');
    lines.push(`Sections (${this.sections.length})`);
    if (this.sections.length === 0) {
      lines.push('- none');
    } else {
      for (const section of this.sections) {
        lines.push(
          `- ${section.key}: ${section.title} | fields=${section.relatedFields.length} contracts=${section.relatedContracts.length}`,
        );
      }
    }
    return lines.join('\n');
  }
}
