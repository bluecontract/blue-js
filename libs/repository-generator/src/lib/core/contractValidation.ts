import {
  BlueRepository,
  BlueRepositoryPackage,
  BlueTypeRuntimeMeta,
  validateNoCycles,
  validateStableDoesNotDependOnDev,
} from '@blue-labs/repository-contract';
import { BluePackage, BlueTypeMetadata } from '../types';
import { Alias } from './internalTypes';
import { BLUE_REPOSITORY_NAME } from './constants';

type PackagesRecord = Record<string, BlueRepositoryPackage>;

export function validateWithContract(
  packages: BluePackage[],
  repositoryVersions: string[],
  aliasToBlueId: Map<Alias, string>,
): void {
  const contractRepo: BlueRepository = {
    name: BLUE_REPOSITORY_NAME,
    repositoryVersions,
    packages: buildContractPackages(packages, aliasToBlueId),
  };

  validateNoCycles(contractRepo);
  validateStableDoesNotDependOnDev(contractRepo);
}

function buildContractPackages(
  packages: BluePackage[],
  aliasToBlueId: Map<Alias, string>,
): PackagesRecord {
  const result: PackagesRecord = {};

  for (const pkg of packages) {
    const aliases = extractAliases(pkg.name, aliasToBlueId);
    const typesMeta: Record<string, BlueTypeRuntimeMeta> = {};
    const contents: Record<string, unknown> = {};

    for (const type of pkg.types) {
      const currentBlueId =
        type.versions?.[type.versions.length - 1]?.typeBlueId;
      if (!currentBlueId) {
        throw new Error(
          `Type ${pkg.name} is missing a current BlueId in versions.`,
        );
      }

      const typeName = extractTypeName(type);
      typesMeta[currentBlueId] = {
        status: type.status,
        name: typeName,
        versions: type.versions ?? [],
      };
      contents[currentBlueId] = type.content;
    }

    result[pkg.name] = {
      name: pkg.name,
      aliases,
      typesMeta,
      contents,
      schemas: {},
    };
  }

  return result;
}

function extractAliases(
  packageName: string,
  aliasToBlueId: Map<Alias, string>,
): Record<string, string> {
  const aliases: Record<string, string> = {};
  const prefix = `${packageName}/`;
  aliasToBlueId.forEach((blueId, alias) => {
    if (alias.startsWith(prefix)) {
      aliases[alias] = blueId;
    }
  });
  return aliases;
}

function extractTypeName(type: BlueTypeMetadata): string {
  const candidate =
    typeof type.content?.name === 'string'
      ? (type.content.name as string)
      : null;
  if (!candidate) {
    throw new Error('Type content is missing required "name" field.');
  }
  return candidate;
}
