import { AppSDK } from '../../sdk';
import {
  BLUE_AGENT_CLIENT_KEY,
  BlueAgentClientMetadata,
  getMethodDefinition,
} from '../decorators';

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

  public static async getInstance<T extends BaseAgentClient>(
    this: new (agentId: string) => T,
    {
      agentId,
      contract,
    }: {
      agentId?: string;
      contract?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    if (agentId) {
      return new this(agentId);
    }
    const sdk = AppSDK.getInstance();

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
      .filter(Boolean);

    const { objectType } =
      (Reflect.getOwnMetadata(BLUE_AGENT_CLIENT_KEY, this) as
        | BlueAgentClientMetadata
        | undefined) ?? {};

    const response = (await sdk.sendRequest({
      type: 'initialize-agent',
      variables: {
        contract: {
          ...contract,
          object: {
            type: objectType,
            ...(contract?.object ?? {}),
          },
          workflows: methodDefinitions,
        },
      },
    })) as { agentId: string };

    return new this(response.agentId);
  }
}
