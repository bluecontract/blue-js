import type { BlueRepositoryDocument } from '@blue-labs/repository-contract';
export type {
  BluePackage,
  BlueRepositoryDocument,
  BlueTypeMetadata,
  BlueTypeVersion,
} from '@blue-labs/repository-contract';
import { BlueTypeStatusLiteral } from './core/constants';

export type BlueTypeStatus = BlueTypeStatusLiteral;

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
