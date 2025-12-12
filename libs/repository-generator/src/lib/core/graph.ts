import { Alias, DiscoveredType } from './internalTypes';
import { BLUE_TYPE_STATUS } from './constants';

export type DependencyGraph = Map<Alias, Set<Alias>>;

export function buildDependencyGraph(
  discovered: Map<Alias, DiscoveredType>,
): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const [alias, type] of discovered) {
    const deps = new Set<Alias>();
    for (const ref of type.references) {
      if (!discovered.has(ref)) {
        throw new Error(
          `Type ${alias} references unknown alias ${ref}. Ensure the target type exists.`,
        );
      }
      deps.add(ref);
    }
    graph.set(alias, deps);
  }

  return graph;
}

export function topoSort(graph: DependencyGraph): Alias[] {
  const order: Alias[] = [];
  const state = new Map<Alias, 'visiting' | 'visited'>();

  const visit = (node: Alias, pathStack: Alias[]) => {
    const currentState = state.get(node);
    if (currentState === 'visited') {
      return;
    }
    if (currentState === 'visiting') {
      const cyclePath = [...pathStack, node].join(' -> ');
      throw new Error(`Circular type dependency detected: ${cyclePath}`);
    }

    state.set(node, 'visiting');
    pathStack.push(node);
    const deps = graph.get(node) || new Set<Alias>();
    for (const dep of deps) {
      visit(dep, pathStack);
    }
    pathStack.pop();
    state.set(node, 'visited');
    order.push(node);
  };

  for (const node of graph.keys()) {
    if (!state.has(node)) {
      visit(node, []);
    }
  }

  return order;
}

export function enforceStableToDevRule(
  graph: DependencyGraph,
  discovered: Map<Alias, DiscoveredType>,
) {
  const memo = new Map<Alias, boolean>();

  const reachesDev = (alias: Alias): boolean => {
    if (memo.has(alias)) {
      return memo.get(alias) ?? false;
    }
    const deps = graph.get(alias) || new Set<Alias>();
    for (const dep of deps) {
      const depType = discovered.get(dep);
      if (!depType) {
        continue;
      }
      if (depType.status === BLUE_TYPE_STATUS.Dev || reachesDev(dep)) {
        memo.set(alias, true);
        return true;
      }
    }
    memo.set(alias, false);
    return false;
  };

  for (const [alias, type] of discovered) {
    if (type.status === BLUE_TYPE_STATUS.Stable && reachesDev(alias)) {
      throw new Error(
        `Stable type ${alias} depends on a dev type. Stable types may only depend on other stable types.`,
      );
    }
  }
}
