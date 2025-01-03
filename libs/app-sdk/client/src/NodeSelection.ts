/* eslint-disable @typescript-eslint/no-unused-vars */
import { Observer } from 'type-fest';
import { BaseAgentClient } from './api/agents/BaseAgentClient';
import { BlueAgentClient, BlueMethod, BlueMethodParam } from './api/decorators';
import { isFunction } from 'radash';

type QueryOperator<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $in?: T[];
  $nin?: T[];
  $exists?: boolean;
  $regex?: RegExp | string;
};

type QueryCondition<T> = {
  [P in keyof T]?: T[P] | QueryOperator<T[P]>;
};

export class NodeSelection<
  T,
  O extends readonly (typeof BaseAgentClient)[] = []
> {
  private queryConditions: QueryCondition<T>[] = [];
  private operationClasses: Set<O[number]> = new Set();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private classType: { new (...args: any[]): T }) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static find<T>(classType: new (...args: any[]) => T): NodeSelection<T, []> {
    return new NodeSelection<T>(classType);
  }

  where(query: QueryCondition<T>): this {
    this.queryConditions.push(query);
    return this;
  }

  withOperations<const NewO extends readonly (typeof BaseAgentClient)[]>(
    ...operationsClasses: NewO
  ): NodeSelection<T, NewO> {
    const selection = this as NodeSelection<T, NewO>;
    selection.operationClasses = new Set(operationsClasses);
    return selection;
  }

  async execute(): Promise<Result<T>> {
    const methodDefinitions = Array.from(this.operationClasses).map(
      (OperationsClass) => OperationsClass.getMethodDefinitions()
    );

    const query = {
      type: this.classType.name,
      conditions: this.queryConditions,
      methodDefinitions,
    };

    try {
      const response = await fetch('/api/nodes/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error('Query failed');
      }

      const node = await response.json();
      return new Result(node, this.operationClasses);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to execute query: ${error.message}`);
      }
      throw new Error(`Failed to execute query: ${error}`);
    }
  }
}

class Result<T> {
  private observers: Observer<T>[] = [];
  private operationsInstances: Map<typeof BaseAgentClient, BaseAgentClient> =
    new Map();

  constructor(
    private node: T,
    private operationClasses: Set<typeof BaseAgentClient>
  ) {
    this.initializeOperations();
  }

  private initializeOperations(): void {
    this.operationClasses.forEach((OperationsClass) => {
      // TODO: pass agentId instead of node
      // Assuming the node has an 'id' property. If it's named differently, adjust accordingly
      const agentId = (this.node as unknown as { blueId: string }).blueId;
      const operations = new OperationsClass(agentId);
      const proxiedOperations = this.createOperationsProxy(operations);
      this.operationsInstances.set(OperationsClass, proxiedOperations);
    });
  }

  private createOperationsProxy(operations: BaseAgentClient): BaseAgentClient {
    return new Proxy(operations, {
      get: (target: BaseAgentClient, prop: string | symbol) => {
        const original = target[prop as keyof typeof target];
        if (isFunction(original)) {
          return (...args: unknown[]) => {
            const result = original.apply(target, args);
            this.updateNode(() => this.node);
            return result;
          };
        }
        return original;
      },
    });
  }

  getNode(): T {
    return this.node;
  }

  subscribe(observer: Observer<T>): () => void {
    this.observers.push(observer);
    observer.next(this.node);

    return () => {
      this.observers = this.observers.filter((obs) => obs !== observer);
    };
  }

  private updateNode(updater: (node: T) => T) {
    this.node = updater(this.node);
    this.notifyObservers();
  }

  private notifyObservers() {
    this.observers.forEach((observer) => observer.next(this.node));
  }

  getImplFor<O extends BaseAgentClient>(
    OperationsClass: (new (agentId: string) => O) & typeof BaseAgentClient
  ): O {
    const operations = this.operationsInstances.get(OperationsClass);
    if (!operations) {
      throw new Error(
        `Operations class ${OperationsClass.name} not registered`
      );
    }
    return operations as O;
  }
}

class Person {
  constructor(
    public name: string,
    public age: number,
    public address: string
  ) {}
}

@BlueAgentClient({ objectType: 'Person' })
class PersonNameOperations extends BaseAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setName(@BlueMethodParam('String') name: string): Promise<boolean> {
    throw new Error('Not implemented.');
  }
}

@BlueAgentClient({ objectType: 'Person' })
class PersonAgeOperations extends BaseAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setAge(@BlueMethodParam('Number') age: number) {
    throw new Error('Not implemented.');
  }
}

@BlueAgentClient({ objectType: 'Person' })
class PersonAddressOperations extends BaseAgentClient {
  @BlueMethod({ returnType: 'Boolean' })
  setAddress(@BlueMethodParam('String') address: string) {
    throw new Error('Not implemented.');
  }
}

(async () => {
  const result = await NodeSelection.find(Person)
    .where({
      age: {
        $gt: 20,
      },
    })
    .withOperations(
      PersonNameOperations,
      PersonAgeOperations,
      PersonAddressOperations
    )
    .execute();

  const ops = result.getImplFor(PersonNameOperations);

  await ops.setName('Alice');
})();
