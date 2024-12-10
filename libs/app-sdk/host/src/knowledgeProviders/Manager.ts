import { KnowledgeProvider } from './types';

export class KnowledgeProviderManager {
  private providers: KnowledgeProvider[] = [];

  registerProvider(provider: KnowledgeProvider) {
    this.providers.push(provider);
  }

  setExecutionOrder(order: string[]) {
    this.providers.sort(
      (a, b) => order.indexOf(a.name) - order.indexOf(b.name)
    );
  }

  getProviders(): KnowledgeProvider[] {
    return this.providers;
  }

  unregisterProvider(name: string): boolean {
    const index = this.providers.findIndex(
      (provider) => provider.name === name
    );
    if (index !== -1) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }
}
