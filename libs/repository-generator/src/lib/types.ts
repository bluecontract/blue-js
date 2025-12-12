import { JsonBlueValue } from '@blue-labs/language';
import { BlueTypeStatusLiteral } from './core/constants';

export type BlueTypeStatus = BlueTypeStatusLiteral;

export interface BlueTypeVersion {
  repositoryVersionIndex: number;
  typeBlueId: string;
  attributesAdded: string[];
}

export interface BlueTypeMetadata {
  status: BlueTypeStatus;
  content: Record<string, JsonBlueValue>;
  versions: BlueTypeVersion[];
}

export interface BluePackage {
  name: string;
  types: BlueTypeMetadata[];
}

export interface BlueRepositoryDocument {
  name: string;
  packages: BluePackage[];
  repositoryVersions: string[];
}

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
