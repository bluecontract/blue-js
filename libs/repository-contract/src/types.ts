import type { ZodTypeAny } from 'zod';
import { JsonValue } from '@blue-labs/shared-utils';

export type AnyZodSchema = ZodTypeAny;

export type RepoName = string;
export type RepoBlueId = string;
export type PackageName = string;
export type TypeBlueId = string;
export type TypeAlias = string;

export type BlueRepositoryStatus = 'stable' | 'dev';

export interface BlueRepositoryVersionEntry {
  repositoryVersionIndex: number;
  typeBlueId: TypeBlueId;
  attributesAdded: readonly string[];
}

export interface BlueTypeRuntimeMeta {
  status: BlueRepositoryStatus;
  name: string;
  versions: readonly BlueRepositoryVersionEntry[];
}

export interface BlueRepositoryPackage {
  name: PackageName;
  aliases: Record<TypeAlias, TypeBlueId>;
  typesMeta: Record<TypeBlueId, BlueTypeRuntimeMeta>;
  contents: Record<TypeBlueId, JsonValue>;
  schemas: Record<TypeBlueId, AnyZodSchema>;
}

export interface BlueRepository {
  name: RepoName;
  repositoryVersions: readonly RepoBlueId[];
  packages: Record<PackageName, BlueRepositoryPackage>;
}

export type BlueTypeVersion = BlueRepositoryVersionEntry;

export interface BlueTypeMetadata {
  status: BlueRepositoryStatus;
  content: JsonValue;
  versions: BlueTypeVersion[];
}

export interface BluePackage {
  name: PackageName;
  types: BlueTypeMetadata[];
}

export interface BlueRepositoryDocument {
  name: RepoName;
  packages: BluePackage[];
  repositoryVersions: RepoBlueId[];
}
