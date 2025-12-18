import type {
  BlueRepository,
  BlueRepositoryPackage,
  BlueTypeRuntimeMeta,
  TypeAlias,
  TypeBlueId,
} from './types.js';

type Ref = TypeBlueId | TypeAlias;

function extractRef(value: unknown): Ref | null {
  if (typeof value === 'string') {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { blueId?: unknown }).blueId === 'string'
  ) {
    return (value as { blueId: string }).blueId;
  }
  return null;
}

export function collectTypeRefsFromContent(content: unknown): Set<Ref> {
  const refs = new Set<Ref>();
  const seen = new WeakSet<object>();

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const obj = node as Record<string, unknown>;
    if (seen.has(obj)) {
      return;
    }
    seen.add(obj);

    for (const key of ['type', 'itemType', 'keyType', 'valueType']) {
      if (key in obj) {
        const ref = extractRef(obj[key]);
        if (ref) {
          refs.add(ref);
        }
      }
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };

  if (Array.isArray(content)) {
    content.forEach(visit);
  } else {
    visit(content);
  }

  return refs;
}

function getTypesMeta(
  pkg: BlueRepositoryPackage,
): Record<TypeBlueId, BlueTypeRuntimeMeta> {
  const fromTypesMeta = (
    pkg as {
      typesMeta?: Record<TypeBlueId, BlueTypeRuntimeMeta>;
    }
  ).typesMeta;
  if (fromTypesMeta) {
    return fromTypesMeta;
  }
  const fromLegacyTypeMetas = (
    pkg as {
      typeMetas?: Record<TypeBlueId, BlueTypeRuntimeMeta>;
    }
  ).typeMetas;
  if (fromLegacyTypeMetas) {
    return fromLegacyTypeMetas;
  }
  const direct = pkg.typesMeta as
    | Record<TypeBlueId, BlueTypeRuntimeMeta>
    | undefined;
  return direct ?? {};
}

function buildResolver(packages: Record<string, BlueRepositoryPackage>): {
  allTypeMetas: Map<TypeBlueId, BlueTypeRuntimeMeta>;
  aliasToBlueId: Map<TypeAlias, TypeBlueId>;
} {
  const aliasToBlueId = new Map<TypeAlias, TypeBlueId>();
  const allTypeMetas = new Map<TypeBlueId, BlueTypeRuntimeMeta>();

  Object.values(packages).forEach((pkg) => {
    Object.entries(pkg.aliases || {}).forEach(([alias, blueId]) => {
      aliasToBlueId.set(alias, blueId);
      aliasToBlueId.set(alias.toLowerCase(), blueId);
    });
    Object.entries(getTypesMeta(pkg)).forEach(([blueId, meta]) => {
      allTypeMetas.set(blueId, meta);
    });
  });

  return { allTypeMetas, aliasToBlueId };
}

function resolveRef(
  ref: Ref,
  aliasToBlueId: Map<TypeAlias, TypeBlueId>,
  allTypeMetas: Map<TypeBlueId, BlueTypeRuntimeMeta>,
): TypeBlueId | null {
  if (allTypeMetas.has(ref)) {
    return ref;
  }
  const resolved =
    aliasToBlueId.get(ref) ?? aliasToBlueId.get(ref.toLowerCase());
  if (resolved) {
    return resolved;
  }
  return null;
}

export function validateNoCycles(repository: BlueRepository): void {
  const { aliasToBlueId, allTypeMetas } = buildResolver(repository.packages);
  const adjacency = new Map<TypeBlueId, Set<TypeBlueId>>();

  for (const pkg of Object.values(repository.packages)) {
    Object.entries(pkg.contents || {}).forEach(([blueId, content]) => {
      const refs = collectTypeRefsFromContent(content);
      refs.forEach((ref) => {
        const resolved = resolveRef(ref, aliasToBlueId, allTypeMetas);
        if (resolved) {
          const set = adjacency.get(blueId) ?? new Set<TypeBlueId>();
          set.add(resolved);
          adjacency.set(blueId, set);
        }
      });
    });
  }

  const visiting = new Set<TypeBlueId>();
  const visited = new Set<TypeBlueId>();

  const dfs = (node: TypeBlueId, path: TypeBlueId[]) => {
    if (visiting.has(node)) {
      const cyclePath = [...path, node].join(' -> ');
      throw new Error(
        `Repository contains a type reference cycle: ${cyclePath}`,
      );
    }
    if (visited.has(node)) {
      return;
    }
    visiting.add(node);
    const next = adjacency.get(node);
    if (next) {
      next.forEach((neighbor) => dfs(neighbor, [...path, neighbor]));
    }
    visiting.delete(node);
    visited.add(node);
  };

  adjacency.forEach((_neighbors, node) => {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  });
}

export function validateStableDoesNotDependOnDev(
  repository: BlueRepository,
): void {
  const { aliasToBlueId, allTypeMetas } = buildResolver(repository.packages);

  const resolve = (ref: Ref) => resolveRef(ref, aliasToBlueId, allTypeMetas);

  for (const [pkgName, pkg] of Object.entries(repository.packages)) {
    const typesMeta = getTypesMeta(pkg);
    for (const [blueId, meta] of Object.entries(typesMeta)) {
      if (meta.status !== 'stable') continue;
      const refs = collectTypeRefsFromContent(pkg.contents[blueId]);
      for (const ref of refs) {
        const resolved = resolve(ref);
        if (!resolved) continue;
        const targetMeta = allTypeMetas.get(resolved);
        if (targetMeta?.status === 'dev') {
          throw new Error(
            `Stable type ${pkgName}/${meta.name} depends on dev type ${resolved}`,
          );
        }
      }
    }
  }
}
