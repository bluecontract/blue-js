import { BlueNode } from '@blue-labs/language';
import { ScopeRuntimeContext } from './scope-runtime-context.js';

export class EmissionRegistry {
  private readonly scopesMap = new Map<string, ScopeRuntimeContext>();
  private readonly rootEmissionList: BlueNode[] = [];

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

  rootEmissions(): readonly BlueNode[] {
    return [...this.rootEmissionList];
  }

  recordRootEmission(emission: BlueNode): void {
    this.rootEmissionList.push(emission);
  }

  isScopeTerminated(scopePath: string): boolean {
    return this.scopesMap.get(scopePath)?.isTerminated() ?? false;
  }

  clearScope(scopePath: string): void {
    this.scopesMap.delete(scopePath);
  }
}
