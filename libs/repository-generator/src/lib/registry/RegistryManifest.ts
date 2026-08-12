import { createHash } from 'node:crypto';
import { JsonCanonicalizer } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import yaml from 'js-yaml';
import {
  BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
  BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
  type BundledRegistrySource,
} from './BundledRegistryResources';

export const BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY =
  'sha256:b705171a6ca62c990792bcb78db9d921caf5b0ed06370648b9a81769d69dd71e';
export const BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY =
  'sha256:46a7744c1cbfa4b00e1d8a99f6ca3f0089ef697de968fee08547894ab02b0ca1';

const LANGUAGE_CORE_KEYS = [
  'Boolean',
  'Dictionary',
  'Double',
  'Integer',
  'List',
  'Text',
] as const;

const CONTRACTS_RUNTIME_KEYS = [
  'Channel',
  'ChannelEventCheckpoint',
  'CheckpointEntry',
  'Contract',
  'ContractExecutionResult',
  'DocumentProcessingInitiated',
  'DocumentProcessingTerminated',
  'DocumentUpdate',
  'DocumentUpdateChannel',
  'EmbeddedEventDelivery',
  'EmbeddedNodeChannel',
  'ExternalChannel',
  'FixtureEvent',
  'Handler',
  'JsonPatchEntry',
  'LifecycleEventChannel',
  'Marker',
  'ProcessEmbedded',
  'ProcessingInitializedMarker',
  'ProcessingTerminatedMarker',
  'RuntimeCounterEntry',
  'RuntimeLedger',
  'ScriptedExternalChannel',
  'ScriptedHandler',
  'TriggeredEventChannel',
  'TypeGeneralizationPolicy',
  'TypeGeneralizationRule',
] as const;

export interface VerifiedRegistryManifestEntry {
  readonly key: string;
  readonly name: string;
  readonly path: string;
  readonly blueId: string;
  readonly sha256: string;
  readonly semanticDescriptionIdentityBearing: true;
  readonly fixtureOnly: boolean;
  readonly source: string;
}

export interface VerifiedRegistryManifest {
  readonly registry: string;
  readonly registryKind: string;
  readonly specificationVersion: string;
  readonly languageVersion?: string;
  readonly fixturePackageIdentity: string;
  readonly packageIdentity: string;
  readonly entries: readonly VerifiedRegistryManifestEntry[];
}

export interface VerifyRegistryManifestOptions extends BundledRegistrySource {
  readonly expectedRegistry: string;
  readonly expectedRegistryKind: string;
  readonly expectedSpecificationVersion: string;
  readonly expectedLanguageVersion?: string;
  readonly expectedPackageIdentity: string;
  readonly requiredKeys: readonly string[];
  readonly requireFixtureOnly: boolean;
}

export const BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST = verifyRegistryManifest({
  ...BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
  expectedRegistry: 'blue-language-core',
  expectedRegistryKind: 'core-type',
  expectedSpecificationVersion: '1.0',
  expectedPackageIdentity: BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
  requiredKeys: LANGUAGE_CORE_KEYS,
  requireFixtureOnly: false,
});

export const BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST = verifyRegistryManifest({
  ...BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
  expectedRegistry: 'blue-contracts-runtime',
  expectedRegistryKind: 'runtime-type',
  expectedSpecificationVersion: '1.0',
  expectedLanguageVersion: '1.0',
  expectedPackageIdentity: BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
  requiredKeys: CONTRACTS_RUNTIME_KEYS,
  requireFixtureOnly: true,
});

export function verifyRegistryManifest(
  options: VerifyRegistryManifestOptions,
): VerifiedRegistryManifest {
  const raw = requireObject(
    yaml.load(options.manifestSource, { schema: yaml.JSON_SCHEMA }),
    'registry manifest',
  );
  const registry = requireString(raw, 'registry');
  const registryKind = requireString(raw, 'registryKind');
  const specificationVersion = requireString(raw, 'specificationVersion');
  const languageVersion = optionalString(raw, 'languageVersion');
  const fixturePackageIdentity = requireSha256Identity(
    requireString(raw, 'fixturePackageIdentity'),
    'fixturePackageIdentity',
  );
  const packageIdentity = requireSha256Identity(
    requireString(raw, 'packageIdentity'),
    'packageIdentity',
  );

  if (
    registry !== options.expectedRegistry ||
    registryKind !== options.expectedRegistryKind ||
    specificationVersion !== options.expectedSpecificationVersion ||
    languageVersion !== options.expectedLanguageVersion
  ) {
    throw new Error(
      `Unexpected registry identity ${registry}/${registryKind}/${specificationVersion}.`,
    );
  }
  if (packageIdentity !== options.expectedPackageIdentity) {
    throw new Error(
      `Registry trust anchor mismatch: expected ${options.expectedPackageIdentity}, found ${packageIdentity}.`,
    );
  }
  const calculatedPackageIdentity = calculateRegistryPackageIdentity(raw);
  if (calculatedPackageIdentity !== packageIdentity) {
    throw new Error(
      `Registry package identity mismatch: manifest=${packageIdentity}, calculated=${calculatedPackageIdentity}.`,
    );
  }

  const rawEntries = raw.entries;
  if (!Array.isArray(rawEntries)) {
    throw new Error('Registry manifest entries must be a list.');
  }
  const seenKeys = new Set<string>();
  const seenPaths = new Set<string>();
  const seenBlueIds = new Set<string>();
  const seenNames = new Set<string>();
  const entries = rawEntries.map((value, index) => {
    const rawEntry = requireObject(value, `registry entry ${index}`);
    const key = requireString(rawEntry, 'key');
    const path = requireString(rawEntry, 'path');
    const blueId = requireString(rawEntry, 'blueId');
    const expectedDigest = requireHexDigest(
      requireString(rawEntry, 'sha256'),
      `${key}.sha256`,
    );
    const identityBearing = rawEntry.semanticDescriptionIdentityBearing;
    if (identityBearing !== true) {
      throw new Error(
        `Registry entry ${key} must declare semanticDescriptionIdentityBearing: true.`,
      );
    }
    const fixtureOnlyValue = rawEntry.fixtureOnly;
    if (options.requireFixtureOnly && typeof fixtureOnlyValue !== 'boolean') {
      throw new Error(`Registry entry ${key} must declare fixtureOnly.`);
    }
    if (
      fixtureOnlyValue !== undefined &&
      typeof fixtureOnlyValue !== 'boolean'
    ) {
      throw new Error(`Registry entry ${key} has invalid fixtureOnly.`);
    }
    if (seenKeys.has(key) || seenPaths.has(path) || seenBlueIds.has(blueId)) {
      throw new Error(`Registry entry ${key} is not unique.`);
    }
    seenKeys.add(key);
    seenPaths.add(path);
    seenBlueIds.add(blueId);

    const source = options.entrySources[path];
    if (source === undefined) {
      throw new Error(`Registry entry ${key} is missing resource ${path}.`);
    }
    const calculatedDigest = sha256(source);
    if (calculatedDigest !== expectedDigest) {
      throw new Error(
        `Registry resource digest mismatch for ${path}: manifest=${expectedDigest}, calculated=${calculatedDigest}.`,
      );
    }
    const rawContent = requireObject(
      yaml.load(source, { schema: yaml.JSON_SCHEMA }),
      `registry resource ${path}`,
    );
    const name = requireString(rawContent, 'name');
    const description = requireString(rawContent, 'description');
    if (description.trim().length === 0) {
      throw new Error(`Registry resource ${path} has an empty description.`);
    }
    if (seenNames.has(name)) {
      throw new Error(`Registry type name ${name} is not unique.`);
    }
    seenNames.add(name);

    return Object.freeze({
      key,
      name,
      path,
      blueId,
      sha256: expectedDigest,
      semanticDescriptionIdentityBearing: true as const,
      fixtureOnly: fixtureOnlyValue === true,
      source,
    });
  });

  assertExactSet('registry keys', seenKeys, options.requiredKeys);
  assertExactSet(
    'registry resources',
    new Set(Object.keys(options.entrySources)),
    entries.map((entry) => entry.path),
  );

  return Object.freeze({
    registry,
    registryKind,
    specificationVersion,
    languageVersion,
    fixturePackageIdentity,
    packageIdentity,
    entries: Object.freeze(entries),
  });
}

export function calculateRegistryPackageIdentity(
  manifest: Readonly<Record<string, unknown>>,
): string {
  const normalized = {
    ...manifest,
    packageIdentity: null,
    fixturePackageIdentity: null,
  };
  const canonical = JsonCanonicalizer.canonicalize(normalized as JsonValue);
  if (canonical === undefined) {
    throw new Error('Unable to canonicalize registry manifest.');
  }
  return `sha256:${sha256(canonical)}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertExactSet(
  label: string,
  actual: ReadonlySet<string>,
  expectedValues: readonly string[],
): void {
  const expected = new Set(expectedValues);
  const missing = [...expected].filter((value) => !actual.has(value));
  const unexpected = [...actual].filter((value) => !expected.has(value));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `${label} mismatch; missing=[${missing.join(', ')}], unexpected=[${unexpected.join(', ')}].`,
    );
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(
  value: Readonly<Record<string, unknown>>,
  field: string,
): string {
  const result = value[field];
  if (typeof result !== 'string' || result.length === 0) {
    throw new Error(`Registry field ${field} must be a non-empty string.`);
  }
  return result;
}

function optionalString(
  value: Readonly<Record<string, unknown>>,
  field: string,
): string | undefined {
  const result = value[field];
  if (result === undefined) {
    return undefined;
  }
  if (typeof result !== 'string' || result.length === 0) {
    throw new Error(`Registry field ${field} must be a non-empty string.`);
  }
  return result;
}

function requireHexDigest(value: string, label: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireSha256Identity(value: string, label: string): string {
  if (!/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a sha256 identity.`);
  }
  return value;
}
