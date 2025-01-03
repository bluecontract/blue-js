import { getMethodDefinition } from '../decorators';

const getPrototypeChain = (proto: unknown): object[] => {
  if (typeof proto !== 'object' || proto === null) {
    return [];
  }

  const chain: object[] = [];
  let current = proto;

  while (current && current !== Object.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }
  return chain;
};

export class BaseAgentClient {
  public constructor(public agentId: string) {}

  public static getMethodDefinitions() {
    const proto = this.prototype;

    const protoChain = getPrototypeChain(proto);

    const methods = protoChain.reduce((allMethods: string[], proto) => {
      const prototypeMethods = Object.getOwnPropertyNames(proto).filter(
        (name) => {
          const descriptor = Object.getOwnPropertyDescriptor(proto, name);
          return (
            descriptor &&
            typeof descriptor.value === 'function' &&
            name !== 'constructor'
          );
        }
      );
      return [...allMethods, ...prototypeMethods];
    }, []);

    const methodDefinitions = methods
      .map((methodName) => {
        return getMethodDefinition(proto, methodName);
      })
      .filter((v) => v !== null && v !== undefined);

    return methodDefinitions;
  }
}
