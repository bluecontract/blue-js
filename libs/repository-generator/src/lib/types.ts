import type {
  BluePackage as ContractBluePackage,
  BlueRepositoryDocument as ContractBlueRepositoryDocument,
  BlueTypeMetadata as ContractBlueTypeMetadata,
  BlueTypeVersion as ContractBlueTypeVersion,
} from '@blue-labs/repository-contract';
import { BlueTypeStatusLiteral } from './core/constants';

export type BlueTypeStatus = BlueTypeStatusLiteral;

export type BlueTypeVersion = ContractBlueTypeVersion;
export type BlueTypeMetadata = ContractBlueTypeMetadata;
export type BluePackage = ContractBluePackage;
export type BlueRepositoryDocument = ContractBlueRepositoryDocument;

export type GeneratorMode = 'check' | 'write';

export interface GenerateRepositoryOptions {
  repoRoot: string;
  blueRepositoryPath: string;
  verbose?: boolean;
}

export interface GenerateRepositoryResult {
  document: BlueRepositoryDocument;
  currentRepoBlueId: string;
  previousRepoBlueId?: string | null;
  changed: boolean;
  yaml: string;
  existingYaml?: string;
}
