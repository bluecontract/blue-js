import fs from 'fs';
import yaml from 'js-yaml';
import { yamlBlueParse } from '@blue-labs/language';
import { BLUE_REPOSITORY_NAME } from './constants';
import { BluePackage, BlueRepositoryDocument } from '../types';
import { isRecord } from './utils';
import { JsonMap } from './internalTypes';

export function readExistingRepository(blueRepositoryPath: string): {
  existingYaml?: string;
  previous: BlueRepositoryDocument | null;
} {
  if (!fs.existsSync(blueRepositoryPath)) {
    return { previous: null };
  }

  const existingYaml = fs.readFileSync(blueRepositoryPath, 'utf8');
  const parsed = yamlBlueParse(existingYaml);
  if (!parsed || !isRecord(parsed)) {
    throw new Error('Existing BlueRepository.blue is not a valid object.');
  }

  const parsedObject = parsed as JsonMap;
  const packagesValue = parsedObject.packages;
  const repositoryVersionsValue = parsedObject.repositoryVersions;
  const packagesAreValid =
    Array.isArray(packagesValue) &&
    packagesValue.every(
      (pkg) =>
        isRecord(pkg) &&
        typeof (pkg as { name?: unknown }).name === 'string' &&
        Array.isArray((pkg as { types?: unknown }).types),
    );
  const repositoryVersionsAreValid =
    Array.isArray(repositoryVersionsValue) &&
    repositoryVersionsValue.every((entry) => typeof entry === 'string');

  if (!packagesAreValid || !repositoryVersionsAreValid) {
    throw new Error(
      'Invalid BlueRepository.blue structure: expected { packages: BluePackage[], repositoryVersions: string[] }',
    );
  }

  const parsedPackages = packagesValue as unknown as BluePackage[];
  const parsedRepositoryVersions =
    repositoryVersionsValue as unknown as string[];
  const document = {
    name:
      typeof parsedObject.name === 'string'
        ? parsedObject.name
        : BLUE_REPOSITORY_NAME,
    packages: parsedPackages,
    repositoryVersions: parsedRepositoryVersions,
  } satisfies BlueRepositoryDocument;

  return { existingYaml, previous: document };
}

export function serializeRepository(document: BlueRepositoryDocument): string {
  return yaml.dump(document, { lineWidth: -1 });
}
