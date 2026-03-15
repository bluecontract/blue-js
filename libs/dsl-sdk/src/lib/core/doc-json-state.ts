import { getPointer, removePointer, setPointer } from './pointers.js';
import type {
  JsonObject,
  JsonValue,
  SectionContext,
  SectionSnapshot,
} from './types.js';

const RESERVED_ROOT_KEYS = new Set([
  'name',
  'description',
  'type',
  'contracts',
  'policies',
]);

function newSection(
  key: string,
  title: string,
  summary?: string,
  relatedFields: Iterable<string> = [],
  relatedContracts: Iterable<string> = [],
): SectionContext {
  return {
    key,
    title,
    summary,
    relatedFields: new Set(relatedFields),
    relatedContracts: new Set(relatedContracts),
  };
}

function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

function sanitizeSectionValue(
  value: JsonValue | undefined,
  sectionKey: string,
): SectionContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as JsonObject;
  if (raw.type !== 'Conversation/Document Section') {
    return null;
  }
  const title = typeof raw.title === 'string' ? raw.title : sectionKey;
  const summary = typeof raw.summary === 'string' ? raw.summary : undefined;
  const relatedFields = Array.isArray(raw.relatedFields)
    ? raw.relatedFields.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  const relatedContracts = Array.isArray(raw.relatedContracts)
    ? raw.relatedContracts.filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  return newSection(
    sectionKey,
    title,
    summary,
    relatedFields,
    relatedContracts,
  );
}

export class DocJsonState {
  private readonly document: JsonObject;
  private readonly sections = new Map<string, SectionContext>();
  private currentSection: SectionContext | null = null;

  constructor(initial?: JsonObject) {
    this.document = initial ? structuredClone(initial) : {};
  }

  setName(name: string): this {
    this.document.name = assertNonEmpty(name, 'name');
    return this;
  }

  setDescription(description: string): this {
    this.document.description = assertNonEmpty(description, 'description');
    return this;
  }

  setType(typeAlias: string): this {
    this.document.type = assertNonEmpty(typeAlias, 'type');
    return this;
  }

  setValue(path: string, value: JsonValue): this {
    setPointer(this.document, path, value);
    this.trackField(path);
    return this;
  }

  removeValue(path: string): this {
    removePointer(this.document, path);
    return this;
  }

  getValue(path: string): JsonValue | undefined {
    return getPointer(this.document, path);
  }

  ensureContractsRoot(): JsonObject {
    const contracts = this.document.contracts;
    if (
      contracts &&
      typeof contracts === 'object' &&
      !Array.isArray(contracts)
    ) {
      return contracts as JsonObject;
    }
    const created: JsonObject = {};
    this.document.contracts = created;
    return created;
  }

  setContract(contractKey: string, contract: JsonObject): this {
    const normalizedKey = assertNonEmpty(contractKey, 'contract key');
    if (this.currentSection?.key === normalizedKey) {
      throw new Error(
        `Contract key '${normalizedKey}' conflicts with the active section key.`,
      );
    }
    this.ensureContractsRoot()[normalizedKey] = structuredClone(contract);
    this.trackContract(normalizedKey);
    return this;
  }

  removeContract(contractKey: string): this {
    const normalizedKey = assertNonEmpty(contractKey, 'contract key');
    const contracts = this.document.contracts;
    if (
      !contracts ||
      typeof contracts !== 'object' ||
      Array.isArray(contracts)
    ) {
      return this;
    }

    const contractsRoot = contracts as JsonObject;
    delete contractsRoot[normalizedKey];
    if (Object.keys(contractsRoot).length === 0) {
      delete this.document.contracts;
    }
    return this;
  }

  section(key: string, title?: string, summary?: string): this {
    if (this.currentSection) {
      throw new Error(
        `Already in section '${this.currentSection.key}'. Call endSection() first.`,
      );
    }
    const normalizedKey = assertNonEmpty(key, 'section key');
    const existingSection = this.sections.get(normalizedKey);
    const existingContract = this.ensureContractsRoot()[normalizedKey];
    const restoredSection =
      existingSection ?? sanitizeSectionValue(existingContract, normalizedKey);

    if (
      !existingSection &&
      existingContract !== undefined &&
      !restoredSection
    ) {
      throw new Error(
        `Section key '${normalizedKey}' conflicts with an existing non-section contract.`,
      );
    }
    this.currentSection =
      restoredSection ??
      newSection(
        normalizedKey,
        assertNonEmpty(title ?? normalizedKey, 'section title'),
        summary?.trim() || undefined,
      );
    return this;
  }

  endSection(): this {
    if (!this.currentSection) {
      throw new Error('Not in a section.');
    }

    const snapshot = this.snapshotSection(this.currentSection.key);
    this.sections.set(this.currentSection.key, this.currentSection);
    this.ensureContractsRoot()[this.currentSection.key] = {
      type: 'Conversation/Document Section',
      title: snapshot.title,
      ...(snapshot.summary ? { summary: snapshot.summary } : {}),
      ...(snapshot.relatedFields.length > 0
        ? { relatedFields: [...snapshot.relatedFields] }
        : {}),
      ...(snapshot.relatedContracts.length > 0
        ? { relatedContracts: [...snapshot.relatedContracts] }
        : {}),
    };
    this.currentSection = null;
    return this;
  }

  trackField(path: string): this {
    if (!this.currentSection) {
      return this;
    }
    const normalized = path.trim();
    if (normalized.startsWith('/')) {
      this.currentSection.relatedFields.add(normalized);
    }
    return this;
  }

  trackContract(contractKey: string): this {
    if (!this.currentSection) {
      return this;
    }
    const normalized = contractKey.trim();
    if (normalized.length > 0) {
      this.currentSection.relatedContracts.add(normalized);
    }
    return this;
  }

  snapshotSection(key: string): SectionSnapshot {
    const section = this.sections.get(key) ?? this.currentSection;
    if (!section || section.key !== key) {
      throw new Error(`Section '${key}' is not available`);
    }
    return {
      key: section.key,
      title: section.title,
      summary: section.summary,
      relatedFields: [...section.relatedFields],
      relatedContracts: [...section.relatedContracts],
    };
  }

  build(): JsonObject {
    if (this.currentSection) {
      throw new Error(
        `Unclosed section '${this.currentSection.key}'. Call endSection() before build.`,
      );
    }
    return structuredClone(this.document);
  }

  validateRootPath(path: string): void {
    const normalized = path.trim();
    if (!normalized.startsWith('/')) {
      return;
    }
    const rootKey = normalized.split('/')[1];
    if (rootKey && RESERVED_ROOT_KEYS.has(rootKey)) {
      throw new Error(`Path points at reserved root key: /${rootKey}`);
    }
  }
}
