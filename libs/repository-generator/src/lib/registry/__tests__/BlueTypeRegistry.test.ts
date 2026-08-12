import { BlueIdCalculator, type JsonBlueValue } from '@blue-labs/language';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
  BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
} from '../BundledRegistryResources';
import {
  BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY,
  BLUE_LANGUAGE_CORE_TYPE_REGISTRY,
} from '../BlueTypeRegistry';
import {
  BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST,
  BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
  BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST,
  BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
  calculateRegistryPackageIdentity,
  verifyRegistryManifest,
} from '../RegistryManifest';

describe('bundled Blue type registries', () => {
  it('loads the exact released package identities and entry sets', () => {
    expect(BLUE_LANGUAGE_CORE_TYPE_REGISTRY.packageIdentity).toBe(
      BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
    );
    expect(BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.packageIdentity).toBe(
      BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
    );
    expect(BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST.entries).toHaveLength(6);
    expect(BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST.entries).toHaveLength(27);
    expect(
      BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST.entries
        .filter((entry) => entry.fixtureOnly)
        .map((entry) => entry.key),
    ).toEqual(['FixtureEvent', 'ScriptedExternalChannel', 'ScriptedHandler']);
  });

  it('derives production aliases from verified manifests', () => {
    expect(BLUE_LANGUAGE_CORE_TYPE_REGISTRY.productionBlueIdsByName.Text).toBe(
      'GX7CFUmSDrE2MzptunLCCdZwnuwwrenRQqEnHL4x3uoC',
    );
    expect(
      BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.productionBlueIdsByName.Contract,
    ).toBe('4ugZ87HaumAJezmgvi2QoqfEdqfwpviQavmak8C8ewF4');
    expect(
      BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.productionBlueIdsByName.Handler,
    ).toBe('2Ag2NfcWpCfPqBAR7bFAEL9L3roX3UWGUkDq7nN3D4gV');
    expect(
      BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.productionBlueIdsByName[
        'Contracts Fixture Event'
      ],
    ).toBeUndefined();
  });

  it('returns defensive content that verifies against the published BlueId', () => {
    const blueId = BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.blueId('Contract');
    const first = BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.content('Contract');
    expect(BlueIdCalculator.calculateBlueIdSync(first as JsonBlueValue)).toBe(
      blueId,
    );

    (first as { name: string }).name = 'mutated';
    expect(
      (
        BLUE_CONTRACTS_RUNTIME_TYPE_REGISTRY.content('Contract') as {
          name: string;
        }
      ).name,
    ).toBe('Contract');
  });

  it('treats registry descriptions as identity-bearing content', () => {
    const content = BLUE_LANGUAGE_CORE_TYPE_REGISTRY.content('Text') as {
      description: string;
    };
    const publishedBlueId = BLUE_LANGUAGE_CORE_TYPE_REGISTRY.blueId('Text');
    content.description = `${content.description} changed`;
    expect(
      BlueIdCalculator.calculateBlueIdSync(content as JsonBlueValue),
    ).not.toBe(publishedBlueId);
  });

  it('fails closed when a registry resource no longer matches its digest', () => {
    expect(() =>
      verifyRegistryManifest({
        ...BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
        entrySources: {
          ...BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE.entrySources,
          'Channel.blue':
            BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE.entrySources[
              'Channel.blue'
            ].replace('name: Channel', 'name: Changed Channel'),
        },
        expectedRegistry: 'blue-contracts-runtime',
        expectedRegistryKind: 'runtime-type',
        expectedSpecificationVersion: '1.0',
        expectedLanguageVersion: '1.0',
        expectedPackageIdentity:
          BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
        requiredKeys: BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST.entries.map(
          (entry) => entry.key,
        ),
        requireFixtureOnly: true,
      }),
    ).toThrow(/resource digest mismatch/u);
  });

  it('fails closed when the manifest is not the trusted release', () => {
    expect(() =>
      verifyRegistryManifest({
        ...BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
        manifestSource:
          BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE.manifestSource.replace(
            BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          ),
        expectedRegistry: 'blue-language-core',
        expectedRegistryKind: 'core-type',
        expectedSpecificationVersion: '1.0',
        expectedPackageIdentity: BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
        requiredKeys: BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST.entries.map(
          (entry) => entry.key,
        ),
        requireFixtureOnly: false,
      }),
    ).toThrow(/trust anchor mismatch/u);
  });

  it('fails closed on missing resources and duplicate entries', () => {
    const entrySourcesWithoutText = {
      ...BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE.entrySources,
    };
    delete entrySourcesWithoutText['Text.blue'];
    expect(() =>
      verifyRegistryManifest({
        ...BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
        entrySources: entrySourcesWithoutText,
        expectedRegistry: 'blue-language-core',
        expectedRegistryKind: 'core-type',
        expectedSpecificationVersion: '1.0',
        expectedPackageIdentity: BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
        requiredKeys: BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST.entries.map(
          (entry) => entry.key,
        ),
        requireFixtureOnly: false,
      }),
    ).toThrow(/missing resource Text\.blue/u);

    const duplicateManifest = yaml.load(
      BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE.manifestSource,
      { schema: yaml.JSON_SCHEMA },
    ) as Record<string, unknown>;
    const entries = duplicateManifest.entries as Array<Record<string, unknown>>;
    entries.push({ ...entries[0] });
    const packageIdentity = calculateRegistryPackageIdentity(duplicateManifest);
    duplicateManifest.packageIdentity = packageIdentity;

    expect(() =>
      verifyRegistryManifest({
        ...BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
        manifestSource: yaml.dump(duplicateManifest),
        expectedRegistry: 'blue-language-core',
        expectedRegistryKind: 'core-type',
        expectedSpecificationVersion: '1.0',
        expectedPackageIdentity: packageIdentity,
        requiredKeys: BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST.entries.map(
          (entry) => entry.key,
        ),
        requireFixtureOnly: false,
      }),
    ).toThrow(/is not unique/u);
  });
});
