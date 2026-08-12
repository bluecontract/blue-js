import { createHash } from 'node:crypto';
import { JsonCanonicalizer } from '@blue-labs/language';
import type { JsonValue } from '@blue-labs/shared-utils';
import type { Alias, JsonMap } from './internalTypes';

export interface RepositoryProviderBundleEntry {
  qualifiedName: Alias;
  blueId: string;
  content: JsonMap;
}

export interface RepositoryProviderBundle {
  formatVersion: 1;
  repositoryBlueId: string;
  registryPackageIdentities: {
    language: string;
    contracts: string;
  };
  entries: RepositoryProviderBundleEntry[];
  providerBundleIdentity: string;
}

export function buildProviderBundle(
  repositoryBlueId: string,
  registryPackageIdentities: RepositoryProviderBundle['registryPackageIdentities'],
  aliasToBlueId: ReadonlyMap<Alias, string>,
  aliasToProviderContent: ReadonlyMap<Alias, JsonMap>,
): RepositoryProviderBundle {
  const entries = Array.from(aliasToBlueId.entries())
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([qualifiedName, blueId]) => {
      const content = aliasToProviderContent.get(qualifiedName);
      if (!content) {
        throw new Error(`Missing exact provider content for ${qualifiedName}.`);
      }
      return { qualifiedName, blueId, content };
    });

  const unsigned = {
    formatVersion: 1 as const,
    repositoryBlueId,
    registryPackageIdentities: { ...registryPackageIdentities },
    entries,
    providerBundleIdentity: null,
  };
  const canonical = JsonCanonicalizer.canonicalize(unsigned as JsonValue);
  if (canonical === undefined) {
    throw new Error('Unable to canonicalize the repository provider bundle.');
  }
  const providerBundleIdentity = `sha256:${createHash('sha256')
    .update(canonical, 'utf8')
    .digest('hex')}`;
  return { ...unsigned, providerBundleIdentity };
}

export function serializeProviderBundle(
  bundle: RepositoryProviderBundle,
): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index] - rightBytes[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return leftBytes.length - rightBytes.length;
}
