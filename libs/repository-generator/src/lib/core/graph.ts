import { Alias, DiscoveredType } from './internalTypes';
import { BLUE_TYPE_STATUS } from './constants';

export type DependencyGraph = Map<Alias, Set<Alias>>;

export type AliasComponent = Alias[];

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

export function stronglyConnectedComponents(
  graph: DependencyGraph,
): AliasComponent[] {
  const components: AliasComponent[] = [];
  const indexByAlias = new Map<Alias, number>();
  const lowLinkByAlias = new Map<Alias, number>();
  const stack: Alias[] = [];
  const onStack = new Set<Alias>();
  let nextIndex = 0;

  const visit = (alias: Alias) => {
    indexByAlias.set(alias, nextIndex);
    lowLinkByAlias.set(alias, nextIndex);
    nextIndex += 1;
    stack.push(alias);
    onStack.add(alias);

    for (const dep of graph.get(alias) ?? []) {
      if (!indexByAlias.has(dep)) {
        visit(dep);
        lowLinkByAlias.set(
          alias,
          Math.min(
            lowLinkByAlias.get(alias) ?? 0,
            lowLinkByAlias.get(dep) ?? 0,
          ),
        );
        continue;
      }
      if (onStack.has(dep)) {
        lowLinkByAlias.set(
          alias,
          Math.min(lowLinkByAlias.get(alias) ?? 0, indexByAlias.get(dep) ?? 0),
        );
      }
    }

    if (lowLinkByAlias.get(alias) !== indexByAlias.get(alias)) {
      return;
    }

    const component: AliasComponent = [];
    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) {
        break;
      }
      onStack.delete(item);
      component.push(item);
      if (item === alias) {
        break;
      }
    }
    components.push(component.sort((a, b) => a.localeCompare(b)));
  };

  for (const alias of graph.keys()) {
    if (!indexByAlias.has(alias)) {
      visit(alias);
    }
  }

  return components;
}

export function topoSortComponents(graph: DependencyGraph): AliasComponent[] {
  const components = stronglyConnectedComponents(graph);
  const componentByAlias = new Map<Alias, number>();

  components.forEach((component, componentIndex) => {
    component.forEach((alias) => componentByAlias.set(alias, componentIndex));
  });

  const componentGraph = new Map<number, Set<number>>();
  components.forEach((_component, index) =>
    componentGraph.set(index, new Set()),
  );

  for (const [alias, deps] of graph) {
    const source = componentByAlias.get(alias);
    if (source === undefined) {
      continue;
    }
    for (const dep of deps) {
      const target = componentByAlias.get(dep);
      if (target !== undefined && target !== source) {
        componentGraph.get(source)?.add(target);
      }
    }
  }

  const order: number[] = [];
  const visited = new Set<number>();

  const visit = (componentIndex: number) => {
    if (visited.has(componentIndex)) {
      return;
    }
    visited.add(componentIndex);
    for (const dep of componentGraph.get(componentIndex) ?? []) {
      visit(dep);
    }
    order.push(componentIndex);
  };

  for (const componentIndex of componentGraph.keys()) {
    visit(componentIndex);
  }

  return order.map((componentIndex) => components[componentIndex] ?? []);
}

export function enforceStableToDevRule(
  graph: DependencyGraph,
  discovered: Map<Alias, DiscoveredType>,
) {
  const memo = new Map<Alias, boolean>();

  const reachesDev = (alias: Alias, visiting = new Set<Alias>()): boolean => {
    if (memo.has(alias)) {
      return memo.get(alias) ?? false;
    }
    if (visiting.has(alias)) {
      return false;
    }

    visiting.add(alias);
    const deps = graph.get(alias) || new Set<Alias>();
    for (const dep of deps) {
      const depType = discovered.get(dep);
      if (!depType) {
        continue;
      }
      if (
        depType.status === BLUE_TYPE_STATUS.Dev ||
        reachesDev(dep, visiting)
      ) {
        visiting.delete(alias);
        memo.set(alias, true);
        return true;
      }
    }
    visiting.delete(alias);
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
