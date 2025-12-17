export function collectDropPointers(
  versions: readonly {
    repositoryVersionIndex: number;
    attributesAdded: readonly string[];
  }[],
  targetRepoVersionIndex: number,
): string[] {
  const relevant = versions
    .filter((v) => v.repositoryVersionIndex > targetRepoVersionIndex)
    .sort((a, b) => b.repositoryVersionIndex - a.repositoryVersionIndex);

  const ordered: string[] = [];

  for (const version of relevant) {
    const sortedPointers = [...version.attributesAdded].sort(
      (a, b) => depth(b) - depth(a),
    );
    ordered.push(...sortedPointers);
  }

  return ordered;
}

function depth(pointer: string): number {
  if (!pointer.startsWith('/')) {
    return 0;
  }
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~')).length;
}
