import { repository } from '@blue-repository/types';

type RepositoryPackage = {
  readonly aliases?: Record<string, string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRepositoryPackages(): RepositoryPackage[] {
  if (!isObject(repository)) {
    return [];
  }

  const packages = repository.packages;
  if (!isObject(packages)) {
    return [];
  }

  return Object.values(packages).filter(isObject) as RepositoryPackage[];
}

function buildTypeAliasSet(): ReadonlySet<string> {
  const aliases = new Set<string>();
  for (const pkg of readRepositoryPackages()) {
    if (!pkg.aliases) {
      continue;
    }

    for (const alias of Object.keys(pkg.aliases)) {
      aliases.add(alias);
    }
  }

  return aliases;
}

const SUPPORTED_TYPE_ALIASES = buildTypeAliasSet();

export function isRepositoryTypeAliasAvailable(typeAlias: string): boolean {
  return SUPPORTED_TYPE_ALIASES.has(typeAlias.trim());
}

export function assertRepositoryTypeAliasAvailable(
  typeAlias: string,
  context: string,
): void {
  const normalized = typeAlias.trim();
  if (isRepositoryTypeAliasAvailable(normalized)) {
    return;
  }

  throw new Error(
    `${context} requires repository type alias '${normalized}', but this alias is not available in the currently installed @blue-repository/types package.`,
  );
}
