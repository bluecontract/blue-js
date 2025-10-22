import type { Node } from '../types/index.js';
import { ScopeRuntimeContext } from './scope-runtime-context.js';

export class EmissionRegistry {
  private readonly scopesMap = new Map<string, ScopeRuntimeContext>();
  private readonly rootEmissionList: Node[] = [];

  scopes(): Map<string, ScopeRuntimeContext> {
    return this.scopesMap;
  }

  scope(scopePath: string): ScopeRuntimeContext {
    let context = this.scopesMap.get(scopePath);
    if (!context) {
      context = new ScopeRuntimeContext(scopePath);
      this.scopesMap.set(scopePath, context);
    }
    return context;
  }

  existingScope(scopePath: string): ScopeRuntimeContext | undefined {
    return this.scopesMap.get(scopePath);
  }

  rootEmissions(): readonly Node[] {
    return [...this.rootEmissionList];
  }

  recordRootEmission(emission: Node): void {
    this.rootEmissionList.push(emission);
  }

  isScopeTerminated(scopePath: string): boolean {
    return this.scopesMap.get(scopePath)?.isTerminated() ?? false;
  }

  clearScope(scopePath: string): void {
    this.scopesMap.delete(scopePath);
  }
}
