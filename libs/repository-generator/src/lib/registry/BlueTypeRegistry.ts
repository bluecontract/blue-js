import { BlueIdCalculator, type JsonBlueValue } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import yaml from 'js-yaml';
import {
  BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST,
  BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST,
  type VerifiedRegistryManifest,
  type VerifiedRegistryManifestEntry,
} from './RegistryManifest';

interface VerifiedRegistryEntry extends VerifiedRegistryManifestEntry {
  readonly content: JsonValue;
}

export class BlueTypeRegistry {
  private readonly entriesByKey: ReadonlyMap<string, VerifiedRegistryEntry>;

  public readonly packageIdentity: string;
  public readonly fixturePackageIdentity: string;
  public readonly blueIdsByKey: Readonly<Record<string, string>>;
  public readonly blueIdsByName: Readonly<Record<string, string>>;
  public readonly productionBlueIdsByName: Readonly<Record<string, string>>;
  public readonly namesByBlueId: Readonly<Record<string, string>>;
  public readonly contentByBlueId: Readonly<Record<string, JsonValue>>;
  public readonly productionContentByBlueId: Readonly<
    Record<string, JsonValue>
  >;

  public constructor(public readonly manifest: VerifiedRegistryManifest) {
    const verifiedEntries = manifest.entries.map((entry) => verifyEntry(entry));
    this.entriesByKey = new Map(
      verifiedEntries.map((entry) => [entry.key, entry]),
    );
    this.packageIdentity = manifest.packageIdentity;
    this.fixturePackageIdentity = manifest.fixturePackageIdentity;
    this.blueIdsByKey = indexBy(
      verifiedEntries,
      'key',
      (entry) => entry.blueId,
    );
    this.blueIdsByName = indexBy(
      verifiedEntries,
      'name',
      (entry) => entry.blueId,
    );
    this.productionBlueIdsByName = indexBy(
      verifiedEntries.filter((entry) => !entry.fixtureOnly),
      'name',
      (entry) => entry.blueId,
    );
    this.namesByBlueId = indexBy(
      verifiedEntries,
      'blueId',
      (entry) => entry.name,
    );
    this.contentByBlueId = contentIndex(verifiedEntries);
    this.productionContentByBlueId = contentIndex(
      verifiedEntries.filter((entry) => !entry.fixtureOnly),
    );
  }

  public blueId(key: string): string {
    return this.entry(key).blueId;
  }

  public content(key: string): JsonValue {
    return cloneJson(this.entry(key).content);
  }

  public isFixtureOnly(key: string): boolean {
    return this.entry(key).fixtureOnly;
  }

  private entry(key: string): VerifiedRegistryEntry {
    const entry = this.entriesByKey.get(key);
    if (!entry) {
      throw new Error(`Unknown ${this.manifest.registry} entry: ${key}.`);
    }
    return entry;
  }
}

function verifyEntry(
  entry: VerifiedRegistryManifestEntry,
): VerifiedRegistryEntry {
  const content = yaml.load(entry.source, {
    schema: yaml.JSON_SCHEMA,
  }) as unknown;
  if (!isJsonObject(content)) {
    throw new Error(`Registry resource ${entry.path} must contain one node.`);
  }
  if (content.name !== entry.name) {
    throw new Error(
      `Registry resource ${entry.path} name changed during Blue parsing.`,
    );
  }
  const calculatedBlueId = BlueIdCalculator.calculateBlueIdSync(
    content as JsonBlueValue,
  );
  if (calculatedBlueId !== entry.blueId) {
    throw new Error(
      `Registry BlueId mismatch for ${entry.key}: manifest=${entry.blueId}, calculated=${calculatedBlueId}.`,
    );
  }
  return Object.freeze({
    ...entry,
    content: deepFreeze(cloneJson(content)),
  });
}

function contentIndex(
  entries: readonly VerifiedRegistryEntry[],
): Readonly<Record<string, JsonValue>> {
  return freezeRecord(
    Object.fromEntries(
      entries.map((entry) => [
        entry.blueId,
        deepFreeze(cloneJson(entry.content)),
      ]),
    ),
  );
}

function indexBy<T extends VerifiedRegistryEntry>(
  entries: readonly T[],
  key: 'key' | 'name' | 'blueId',
  value: (entry: T) => string,
): Readonly<Record<string, string>> {
  return freezeRecord(
    Object.fromEntries(entries.map((entry) => [entry[key], value(entry)])),
  );
}

function freezeRecord<T>(
  value: Record<string, T>,
): Readonly<Record<string, T>> {
  return Object.freeze(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export const BLUE_LANGUAGE_CORE_TYPE_REGISTRY = new BlueTypeRegistry(
  BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST,
);
export const BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY = new BlueTypeRegistry(
  BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST,
);

verifyDependencyClosure([
  BLUE_LANGUAGE_CORE_TYPE_REGISTRY,
  BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY,
]);

export function verifyDependencyClosure(
  registries: readonly BlueTypeRegistry[],
): void {
  const knownBlueIds = new Set(
    registries.flatMap((registry) =>
      registry.manifest.entries.map((entry) => entry.blueId),
    ),
  );

  for (const registry of registries) {
    for (const entry of registry.manifest.entries) {
      const references = collectBlueIdReferences(registry.content(entry.key));
      const unresolved = [...references].filter(
        (blueId) => !knownBlueIds.has(blueId),
      );
      if (unresolved.length > 0) {
        throw new Error(
          `Registry entry ${entry.key} has unresolved dependencies: ${unresolved.join(', ')}.`,
        );
      }
    }
  }
}

function collectBlueIdReferences(value: JsonValue): Set<string> {
  const references = new Set<string>();

  const visit = (current: JsonValue): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current === null || typeof current !== 'object') {
      return;
    }
    for (const [key, child] of Object.entries(current)) {
      if (key === 'blueId' && typeof child === 'string') {
        references.add(child);
      } else {
        visit(child);
      }
    }
  };

  visit(value);
  return references;
}
