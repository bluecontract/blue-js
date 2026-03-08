import { BlueNode } from '@blue-labs/language';

import { INTERNAL_BLUE } from '../internal/blue';
import { blueNodeToEditingJson } from '../internal/editing-json';
import type {
  ContractEntry,
  ContractKind,
  DocStructureFieldKind,
  DocStructureSummary,
  EditingJsonObject,
  EditingJsonValue,
  FieldEntry,
  SectionEntry,
} from './types';

const CONTRACTS_KEY = 'contracts';

const SECTION_TYPE = 'Conversation/Document Section';
const POLICY_TYPE = 'Conversation/Contracts Change Policy';
const OPERATION_TYPE = 'Conversation/Operation';
const OPERATION_IMPL_TYPE = 'Conversation/Sequential Workflow Operation';
const WORKFLOW_TYPE = 'Conversation/Sequential Workflow';

export class DocStructure implements DocStructureSummary {
  readonly name?: string;
  readonly description?: string;
  readonly type?: string;
  readonly fields: FieldEntry[];
  readonly contracts: ContractEntry[];
  readonly sections: SectionEntry[];
  readonly policies: ContractEntry[];
  readonly unknownContracts: ContractEntry[];

  private constructor(summary: DocStructureSummary) {
    this.name = summary.name;
    this.description = summary.description;
    this.type = summary.type;
    this.fields = summary.fields;
    this.contracts = summary.contracts;
    this.sections = summary.sections;
    this.policies = summary.policies;
    this.unknownContracts = summary.unknownContracts;
  }

  static from(
    input: BlueNode | DocStructureSummary | DocStructure,
  ): DocStructure {
    if (input instanceof DocStructure) {
      return input;
    }

    if (input instanceof BlueNode) {
      return new DocStructure(extractDocStructure(input));
    }

    return new DocStructure(cloneSummary(input));
  }

  getContract(key: string): ContractEntry | undefined {
    return this.contracts.find((entry) => entry.key === key);
  }

  getSection(key: string): SectionEntry | undefined {
    return this.sections.find((entry) => entry.key === key);
  }

  toSummaryJson(): DocStructureSummary {
    return cloneSummary(this);
  }

  toPromptText(): string {
    const lines: string[] = [];

    lines.push(`Document: ${this.name ?? 'Untitled'}`);
    lines.push(`Type: ${this.type ?? 'untyped'}`);
    if (this.description) {
      lines.push(`Description: ${this.description}`);
    }

    lines.push('');
    lines.push(`Root fields (${this.fields.length}):`);
    if (this.fields.length === 0) {
      lines.push('- none');
    } else {
      for (const field of this.fields) {
        const typeSuffix = field.type ? ` type=${field.type}` : '';
        lines.push(
          `- ${field.path} [${field.kind}]${typeSuffix} ${field.preview}`.trim(),
        );
      }
    }

    lines.push('');
    lines.push(`Contracts (${this.contracts.length}):`);
    if (this.contracts.length === 0) {
      lines.push('- none');
    } else {
      for (const contract of this.contracts) {
        const extras = [
          contract.type ? `type=${contract.type}` : null,
          contract.channel ? `channel=${contract.channel}` : null,
          contract.requestType ? `request=${contract.requestType}` : null,
          contract.eventType ? `event=${contract.eventType}` : null,
        ].filter(Boolean);

        const extraText = extras.length > 0 ? ` (${extras.join(', ')})` : '';
        lines.push(`- ${contract.key} [${contract.kind}]${extraText}`);
      }
    }

    lines.push('');
    lines.push(`Sections (${this.sections.length}):`);
    if (this.sections.length === 0) {
      lines.push('- none');
    } else {
      for (const section of this.sections) {
        const relatedFields =
          section.relatedFields.length > 0
            ? section.relatedFields.join(', ')
            : 'none';
        const relatedContracts =
          section.relatedContracts.length > 0
            ? section.relatedContracts.join(', ')
            : 'none';
        lines.push(`- ${section.key}: ${section.title ?? section.key}`);
        if (section.summary) {
          lines.push(`  summary: ${section.summary}`);
        }
        lines.push(`  fields: ${relatedFields}`);
        lines.push(`  contracts: ${relatedContracts}`);
      }
    }

    if (this.policies.length > 0) {
      lines.push('');
      lines.push(`Policies (${this.policies.length}):`);
      for (const policy of this.policies) {
        lines.push(`- ${policy.key}: ${policy.summary}`);
      }
    }

    if (this.unknownContracts.length > 0) {
      lines.push('');
      lines.push(`Unknown contracts (${this.unknownContracts.length}):`);
      for (const contract of this.unknownContracts) {
        lines.push(`- ${contract.key}: ${contract.type ?? 'untyped'}`);
      }
    }

    return lines.join('\n');
  }
}

export function extractDocStructure(node: BlueNode): DocStructureSummary {
  const fields = extractRootFields(node);
  const extractedContracts = extractContracts(node);
  const sections = extractedContracts
    .filter(
      (entry): entry is ContractEntry & { kind: 'section' } =>
        entry.kind === 'section',
    )
    .map((entry) => toSectionEntry(entry))
    .sort((left, right) => left.key.localeCompare(right.key));
  const policies = extractedContracts.filter(
    (entry) => entry.kind === 'policy',
  );
  const unknownContracts = extractedContracts.filter(
    (entry) => entry.kind === 'other',
  );

  return {
    name: node.getName(),
    description: node.getDescription(),
    type: readNodeType(node),
    fields,
    contracts: extractedContracts,
    sections,
    policies,
    unknownContracts,
  };
}

function cloneSummary(summary: DocStructureSummary): DocStructureSummary {
  return {
    name: summary.name,
    description: summary.description,
    type: summary.type,
    fields: summary.fields.map((field) => ({
      ...field,
      rawValue: field.rawValue == null ? undefined : cloneJson(field.rawValue),
    })),
    contracts: summary.contracts.map((contract) => ({
      ...contract,
      paths: contract.paths ? [...contract.paths] : undefined,
      relatedFields: contract.relatedFields
        ? [...contract.relatedFields]
        : undefined,
      relatedContracts: contract.relatedContracts
        ? [...contract.relatedContracts]
        : undefined,
      compositeChildren: contract.compositeChildren
        ? [...contract.compositeChildren]
        : undefined,
      raw: cloneJson(contract.raw),
    })),
    sections: summary.sections.map((section) => ({
      ...section,
      relatedFields: [...section.relatedFields],
      relatedContracts: [...section.relatedContracts],
      raw: cloneJson(section.raw),
    })),
    policies: summary.policies.map((policy) => ({
      ...policy,
      paths: policy.paths ? [...policy.paths] : undefined,
      relatedFields: policy.relatedFields
        ? [...policy.relatedFields]
        : undefined,
      relatedContracts: policy.relatedContracts
        ? [...policy.relatedContracts]
        : undefined,
      compositeChildren: policy.compositeChildren
        ? [...policy.compositeChildren]
        : undefined,
      raw: cloneJson(policy.raw),
    })),
    unknownContracts: summary.unknownContracts.map((contract) => ({
      ...contract,
      paths: contract.paths ? [...contract.paths] : undefined,
      relatedFields: contract.relatedFields
        ? [...contract.relatedFields]
        : undefined,
      relatedContracts: contract.relatedContracts
        ? [...contract.relatedContracts]
        : undefined,
      compositeChildren: contract.compositeChildren
        ? [...contract.compositeChildren]
        : undefined,
      raw: cloneJson(contract.raw),
    })),
  };
}

function extractRootFields(node: BlueNode): FieldEntry[] {
  const properties = node.getProperties() ?? {};
  return Object.entries(properties)
    .filter(([key]) => key !== CONTRACTS_KEY)
    .map(([key, value]) => toFieldEntry(`/${escapePromptSegment(key)}`, value))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function extractContracts(node: BlueNode): ContractEntry[] {
  const contracts = node.getContracts() ?? {};
  return Object.entries(contracts)
    .map(([key, contractNode]) => toContractEntry(key, contractNode))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function toFieldEntry(path: string, node: BlueNode): FieldEntry {
  return {
    path,
    kind: classifyFieldKind(node),
    preview: createPreview(node),
    type: readNodeType(node),
    rawValue: blueNodeToEditingJson(node),
  };
}

function toContractEntry(key: string, node: BlueNode): ContractEntry {
  const type = readNodeType(node);
  const kind = classifyContractKind(key, type, node);

  const channel = readStringProperty(node, 'channel');
  const requestType = readTypeProperty(node, 'request');
  const requestDescription = readRequestDescription(node);
  const eventType = readTypeProperty(node, 'event');
  const subscriptionId = readStringProperty(node, 'subscriptionId');
  const paths =
    readStringListProperty(node, 'paths') ??
    readSinglePathList(node, 'path') ??
    readStringListProperty(node, 'relatedFields');
  const relatedFields = stableStringList(
    readStringListProperty(node, 'relatedFields'),
  );
  const relatedContracts = stableStringList(
    readStringListProperty(node, 'relatedContracts'),
  );
  const compositeChildren = stableStringList(
    readStringListProperty(node, 'channels'),
  );

  return {
    key,
    type,
    kind,
    summary: createContractSummary(kind, type, channel, requestType, eventType),
    channel,
    operation: readStringProperty(node, 'operation'),
    requestType,
    requestDescription,
    eventType,
    subscriptionId,
    paths,
    relatedFields,
    relatedContracts,
    compositeChildren,
    raw: blueNodeToEditingJson(node),
  };
}

function toSectionEntry(entry: ContractEntry): SectionEntry {
  const raw = entry.raw;
  const rawObject = isJsonObject(raw) ? raw : {};

  return {
    key: entry.key,
    title: readStringJson(rawObject.title),
    summary: readStringJson(rawObject.summary),
    relatedFields: [...(entry.relatedFields ?? [])],
    relatedContracts: [...(entry.relatedContracts ?? [])],
    raw: cloneJson(raw),
  };
}

function classifyFieldKind(node: BlueNode): DocStructureFieldKind {
  if (
    node.getType() ||
    node.getItemType() ||
    node.getKeyType() ||
    node.getValueType() ||
    node.getBlueId() ||
    node.getBlue()
  ) {
    return 'typed-node-like';
  }

  if (node.getItems()) {
    return 'array';
  }

  if (node.getProperties()) {
    return 'object';
  }

  return 'primitive';
}

function classifyContractKind(
  key: string,
  type: string | undefined,
  node: BlueNode,
): ContractKind {
  if (type === SECTION_TYPE) {
    return 'section';
  }

  if (type === POLICY_TYPE || type?.includes('Policy')) {
    return 'policy';
  }

  if (type === OPERATION_TYPE) {
    return 'operation';
  }

  if (type === OPERATION_IMPL_TYPE) {
    return 'operationImpl';
  }

  if (type === WORKFLOW_TYPE) {
    return 'workflow';
  }

  if (
    type?.endsWith('Channel') ||
    key.endsWith('Channel') ||
    readStringListProperty(node, 'channels') != null
  ) {
    return 'channel';
  }

  return 'other';
}

function createPreview(node: BlueNode): string {
  const json = blueNodeToEditingJson(node);
  if (json == null) {
    return 'null';
  }

  if (typeof json === 'string') {
    return quoteAndTrim(json);
  }

  if (typeof json === 'number' || typeof json === 'boolean') {
    return String(json);
  }

  if (Array.isArray(json)) {
    return `array(${json.length})`;
  }

  const keys = Object.keys(json);
  return `object(${keys.length}) ${keys.slice(0, 4).join(', ')}`.trim();
}

function createContractSummary(
  kind: ContractKind,
  type: string | undefined,
  channel: string | undefined,
  requestType: string | undefined,
  eventType: string | undefined,
): string {
  const parts: string[] = [kind];

  if (type) {
    parts.push(type);
  }
  if (channel) {
    parts.push(`channel=${channel}`);
  }
  if (requestType) {
    parts.push(`request=${requestType}`);
  }
  if (eventType) {
    parts.push(`event=${eventType}`);
  }

  return parts.join(' | ');
}

function readNodeType(node: BlueNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const restored = INTERNAL_BLUE.restoreInlineTypes(node.clone());
  const typeNode = restored.getType();
  if (!typeNode) {
    return undefined;
  }

  return readTypeLikeNode(typeNode);
}

function readTypeProperty(node: BlueNode, key: string): string | undefined {
  const propertyNode = node.getProperties()?.[key];
  if (!propertyNode) {
    return undefined;
  }

  return readNodeType(propertyNode) ?? readTypeLikeNode(propertyNode);
}

function readTypeLikeNode(node: BlueNode): string | undefined {
  const value = node.getValue();
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  const json = blueNodeToEditingJson(node);
  if (typeof json === 'string' && json.length > 0) {
    return json;
  }

  if (isJsonObject(json)) {
    const fromValue = readStringJson(json.value);
    if (fromValue) {
      return fromValue;
    }
    const fromBlueId = readStringJson(json.blueId);
    if (fromBlueId) {
      return `blueId:${fromBlueId}`;
    }
  }

  return undefined;
}

function readRequestDescription(node: BlueNode): string | undefined {
  const requestNode = node.getProperties()?.request;
  return requestNode?.getDescription() ?? node.getDescription();
}

function readStringProperty(node: BlueNode, key: string): string | undefined {
  const propertyNode = node.getProperties()?.[key];
  if (!propertyNode) {
    return undefined;
  }

  const value = propertyNode.getValue();
  return typeof value === 'string' ? value : undefined;
}

function readSinglePathList(node: BlueNode, key: string): string[] | undefined {
  const value = readStringProperty(node, key);
  return value ? [value] : undefined;
}

function readStringListProperty(
  node: BlueNode,
  key: string,
): string[] | undefined {
  const propertyNode = node.getProperties()?.[key];
  const items = propertyNode?.getItems();
  if (!items) {
    return undefined;
  }

  return items
    .map((item) => item.getValue())
    .filter((value): value is string => typeof value === 'string');
}

function stableStringList(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }
  return [...values];
}

function quoteAndTrim(value: string): string {
  const trimmed = value.length > 60 ? `${value.slice(0, 57)}...` : value;
  return JSON.stringify(trimmed);
}

function escapePromptSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function cloneJson(value: EditingJsonValue): EditingJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item));
  }
  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJson(entry)]),
    );
  }
  return value;
}

function isJsonObject(
  value: EditingJsonValue | undefined,
): value is EditingJsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readStringJson(
  value: EditingJsonValue | undefined,
): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
