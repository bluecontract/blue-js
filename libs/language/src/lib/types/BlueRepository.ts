import type { ZodTypeAny } from 'zod';
import type { JsonValue } from '@blue-labs/shared-utils';
import type {
  BlueRepository as ContractBlueRepository,
  BlueRepositoryPackage as ContractBlueRepositoryPackage,
  BlueTypeRuntimeMeta as ContractBlueTypeRuntimeMeta,
} from '@blue-labs/repository-contract';

export type BlueTypeRuntimeMeta = ContractBlueTypeRuntimeMeta;
export type BlueRepositoryPackage = ContractBlueRepositoryPackage<
  JsonValue,
  ZodTypeAny
>;
export type BlueRepository = ContractBlueRepository<JsonValue, ZodTypeAny>;
export type VersionedBlueRepository = BlueRepository;
export type AnyBlueRepository = BlueRepository;
