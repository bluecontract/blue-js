import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
  BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
  BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
  BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
  type BundledRegistrySource,
} from '../lib/registry';
import { verifyGeneratorRegistries } from '../lib/core/registry';

describe('repository generator registry inputs', () => {
  it('accepts exact filesystem copies of the bundled registries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-registries-'));
    const languagePath = writeRegistry(
      root,
      'language',
      BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
    );
    const contractsPath = writeRegistry(
      root,
      'contracts',
      BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
    );

    expect(
      verifyGeneratorRegistries({
        languageRegistryPath: path.join(languagePath, 'manifest.yaml'),
        contractsRegistryPath: contractsPath,
      }),
    ).toEqual({
      language: BLUE_LANGUAGE_CORE_REGISTRY_PACKAGE_IDENTITY,
      contracts: BLUE_CONTRACTS_RUNTIME_REGISTRY_PACKAGE_IDENTITY,
    });
  });

  it('rejects extra registry resources', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-registries-'));
    const languagePath = writeRegistry(
      root,
      'language',
      BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE,
    );
    fs.writeFileSync(
      path.join(languagePath, 'Unexpected.blue'),
      'name: Unexpected\n',
      'utf8',
    );

    expect(() =>
      verifyGeneratorRegistries({ languageRegistryPath: languagePath }),
    ).toThrow(/registry resources mismatch/u);
  });

  it('rejects a filesystem registry that differs from its manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-registries-'));
    const contractsPath = writeRegistry(
      root,
      'contracts',
      BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE,
    );
    fs.appendFileSync(path.join(contractsPath, 'Handler.blue'), '\n', 'utf8');

    expect(() =>
      verifyGeneratorRegistries({ contractsRegistryPath: contractsPath }),
    ).toThrow(/resource digest mismatch/u);
  });
});

function writeRegistry(
  root: string,
  name: string,
  source: BundledRegistrySource,
): string {
  const target = path.join(root, name);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(
    path.join(target, 'manifest.yaml'),
    source.manifestSource,
    'utf8',
  );
  for (const [relativePath, content] of Object.entries(source.entrySources)) {
    const filePath = path.join(target, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return target;
}
