import type { BlueRepositoryDocument } from '@blue-labs/repository-contract';
export type {
  BluePackage,
  BlueRepositoryDocument,
  BlueTypeMetadata,
  BlueTypeVersion,
} from '@blue-labs/repository-contract';
import { BlueTypeStatusLiteral } from './core/constants';
import type { RepositoryProviderBundle } from './core/providerBundle';

export type BlueTypeStatus = BlueTypeStatusLiteral;

export type GeneratorMode = 'check' | 'write';

export interface GenerateRepositoryOptions {
  repoRoot: string;
  blueRepositoryPath: string;
  verbose?: boolean;
  languageRegistryPath?: string;
  contractsRegistryPath?: string;
  providerBundlePath?: string;
}

export interface GenerateRepositoryResult {
  document: BlueRepositoryDocument;
  currentRepoBlueId: string;
  previousRepoBlueId?: string | null;
  changed: boolean;
  yaml: string;
  existingYaml?: string;
  providerBundle: RepositoryProviderBundle;
  providerBundleJson: string;
  existingProviderBundleJson?: string;
  providerBundleChanged: boolean;
  registryPackageIdentities: {
    language: string;
    contracts: string;
  };
}
