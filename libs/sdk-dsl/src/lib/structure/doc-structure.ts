import { BlueNode } from '@blue-labs/language';
import { toOfficialJson } from '../core/serialization.js';
import type { JsonObject, JsonValue } from '../core/types.js';

export interface DocFieldEntry {
  readonly path: string;
  readonly value: JsonValue;
}

export interface DocContractEntry {
  readonly key: string;
  readonly type?: string;
  readonly raw: JsonObject;
}

export interface DocSectionEntry {
  readonly key: string;
  readonly title: string;
  readonly summary?: string;
  readonly relatedFields: readonly string[];
  readonly relatedContracts: readonly string[];
}

export interface DocStructureSnapshot {
  readonly name?: string;
  readonly description?: string;
  readonly type?: string;
  readonly fields: readonly DocFieldEntry[];
  readonly contracts: readonly DocContractEntry[];
  readonly sections: readonly DocSectionEntry[];
  readonly unclassifiedContracts: readonly DocContractEntry[];
}

const RESERVED_ROOT_KEYS = new Set([
  'name',
  'description',
  'type',
  'contracts',
]);

function cloneObject(value: JsonObject): JsonObject {
  return structuredClone(value);
}

function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function walkFields(
  value: JsonValue,
  pointer: string,
  output: DocFieldEntry[],
): void {
  if (Array.isArray(value)) {
    output.push({
      path: pointer,
      value: structuredClone(value) as JsonValue,
    });
    return;
  }
  if (!value || typeof value !== 'object') {
    output.push({
      path: pointer,
      value,
    });
    return;
  }
  const object = value as JsonObject;
  const keys = Object.keys(object);
  if (keys.length === 0) {
    output.push({ path: pointer, value: {} });
    return;
  }
  for (const key of keys) {
    walkFields(object[key] as JsonValue, `${pointer}/${key}`, output);
  }
}

export class DocStructure {
  static from(document: BlueNode | JsonObject): DocStructureSnapshot {
    const json =
      document instanceof BlueNode
        ? toOfficialJson(document)
        : (structuredClone(document) as JsonObject);

    const fields: DocFieldEntry[] = [];
    for (const [key, value] of Object.entries(json)) {
      if (RESERVED_ROOT_KEYS.has(key)) {
        continue;
      }
      walkFields(value as JsonValue, `/${key}`, fields);
    }

    const contractsRoot = asJsonObject(json.contracts as JsonValue) ?? {};
    const contracts: DocContractEntry[] = Object.entries(contractsRoot).map(
      ([key, value]) => {
        const raw = asJsonObject(value as JsonValue) ?? {};
        const type = typeof raw.type === 'string' ? raw.type : undefined;
        return {
          key,
          type,
          raw: cloneObject(raw),
        };
      },
    );

    const sections: DocSectionEntry[] = contracts
      .filter((contract) => contract.type === 'Conversation/Document Section')
      .map((sectionContract) => {
        const raw = sectionContract.raw;
        const title =
          typeof raw.title === 'string' ? raw.title : sectionContract.key;
        const summary =
          typeof raw.summary === 'string' ? raw.summary : undefined;
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
        return {
          key: sectionContract.key,
          title,
          summary,
          relatedFields,
          relatedContracts,
        };
      });

    const sectionContractKeys = new Set(sections.map((section) => section.key));
    const unclassifiedContracts = contracts.filter(
      (contract) => !sectionContractKeys.has(contract.key),
    );

    return {
      name: typeof json.name === 'string' ? json.name : undefined,
      description:
        typeof json.description === 'string' ? json.description : undefined,
      type: typeof json.type === 'string' ? json.type : undefined,
      fields,
      contracts,
      sections,
      unclassifiedContracts,
    };
  }
}
