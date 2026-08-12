import fs from 'fs';
import path from 'path';
import {
  BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST,
  BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST,
  verifyRegistryManifest,
  type VerifiedRegistryManifest,
} from '../registry';

export interface RegistryDirectoryOptions {
  readonly languageRegistryPath?: string;
  readonly contractsRegistryPath?: string;
}

export interface RegistryPackageIdentities {
  readonly language: string;
  readonly contracts: string;
}

export function verifyGeneratorRegistries(
  options: RegistryDirectoryOptions,
): RegistryPackageIdentities {
  if (options.languageRegistryPath) {
    verifyRegistryDirectory(
      options.languageRegistryPath,
      BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST,
      false,
    );
  }
  if (options.contractsRegistryPath) {
    verifyRegistryDirectory(
      options.contractsRegistryPath,
      BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST,
      true,
    );
  }
  return {
    language: BLUE_LANGUAGE_CORE_REGISTRY_MANIFEST.packageIdentity,
    contracts: BLUE_CONTRACTS_RUNTIME_REGISTRY_MANIFEST.packageIdentity,
  };
}

function verifyRegistryDirectory(
  registryPath: string,
  expected: VerifiedRegistryManifest,
  requireFixtureOnly: boolean,
): void {
  const inputPath = path.resolve(registryPath);
  const inputStat = fs.statSync(inputPath, { throwIfNoEntry: false });
  const root = inputStat?.isFile() ? path.dirname(inputPath) : inputPath;
  const manifestPath = path.join(root, 'manifest.yaml');
  if (inputStat?.isFile() && path.resolve(manifestPath) !== inputPath) {
    throw new Error(
      `Registry manifest must be named manifest.yaml: ${inputPath}.`,
    );
  }
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Registry path is not a directory: ${root}.`);
  }
  if (!fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Registry manifest is missing: ${manifestPath}.`);
  }
  const entrySources = readBlueFiles(root);
  verifyRegistryManifest({
    manifestSource: fs.readFileSync(manifestPath, 'utf8'),
    entrySources,
    expectedRegistry: expected.registry,
    expectedRegistryKind: expected.registryKind,
    expectedSpecificationVersion: expected.specificationVersion,
    expectedLanguageVersion: expected.languageVersion,
    expectedPackageIdentity: expected.packageIdentity,
    requiredKeys: expected.entries.map((entry) => entry.key),
    requireFixtureOnly,
  });
}

function readBlueFiles(root: string): Record<string, string> {
  const sources: Record<string, string> = {};

  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.blue')) {
        continue;
      }
      const relativePath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join('/');
      sources[relativePath] = fs.readFileSync(absolutePath, 'utf8');
    }
  };

  visit(root);
  return sources;
}
