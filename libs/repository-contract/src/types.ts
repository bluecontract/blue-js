import type { ZodTypeAny } from 'zod';

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
  attributesAdded: string[];
}

export interface BlueTypeRuntimeMeta {
  status: BlueRepositoryStatus;
  name: string;
  versions: readonly BlueRepositoryVersionEntry[];
}

export interface BlueRepositoryPackage<
  ContentT = unknown,
  SchemaT = AnyZodSchema,
> {
  name: PackageName;
  aliases: Record<TypeAlias, TypeBlueId>;
  typesMeta: Record<TypeBlueId, BlueTypeRuntimeMeta>;
  contents: Record<TypeBlueId, ContentT>;
  schemas: Record<TypeBlueId, SchemaT>;
}

export interface BlueRepository<ContentT = unknown, SchemaT = AnyZodSchema> {
  name: RepoName;
  repositoryVersions: readonly RepoBlueId[];
  packages: Record<PackageName, BlueRepositoryPackage<ContentT, SchemaT>>;
}

export type BlueTypeVersion = BlueRepositoryVersionEntry;

export interface BlueTypeMetadata<ContentT = unknown> {
  status: BlueRepositoryStatus;
  content: ContentT;
  versions: BlueTypeVersion[];
}

export interface BluePackage<ContentT = unknown> {
  name: PackageName;
  types: BlueTypeMetadata<ContentT>[];
}

export interface BlueRepositoryDocument<ContentT = unknown> {
  name: RepoName;
  packages: BluePackage<ContentT>[];
  repositoryVersions: RepoBlueId[];
}
