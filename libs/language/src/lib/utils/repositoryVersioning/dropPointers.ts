import { parsePointer } from '@blue-labs/repository-contract';

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
  return parsePointer(pointer).length;
}
