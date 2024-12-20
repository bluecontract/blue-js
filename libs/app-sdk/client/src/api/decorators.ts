import 'reflect-metadata';
import { AppSDK } from '../sdk';
import { BaseAgentClient } from './agents/BaseAgentClient';
import { MethodDefinition } from '@blue-company/app-sdk-core';

const BLUE_ID_KEY = Symbol('blueId');
const BLUE_MARKER_KEY = Symbol('blueMarker');

const BLUE_METHOD_KEY = Symbol('BlueMethod');
type BlueMethodMetadata = {
  returnType: string;
};

export const BLUE_AGENT_CLIENT_KEY = Symbol('BlueAgentClient');
export type BlueAgentClientMetadata = {
  objectType: string;
};

const BLUE_METHOD_PARAMETERS_KEY = Symbol('blueMethodParameters');
type BlueMethodParameterMetadata = {
  index: number;
  type: string;
};

export const TS_BLUE_METHOD_PARAMETERS_KEY = 'TSBlueMethodParameters';
export type TSBlueMethodParameterMetadata = {
  index: number;
  name: string;
  isOptional: boolean;
};
export const TS_BLUE_METHOD_API_CLIENT_CLASS_NAME_KEY =
  'TSBlueMethodApiClientClassName';

const getReflectMetadata = <T>(
  metadataKey: unknown,
  target: object,
  propertyKey: string | symbol
) => {
  return Reflect.getMetadata(metadataKey, target, propertyKey) as T | undefined;
};

export interface BlueAgentClientStatic<T> {
  new (agentId: string): T;
  getInstance(options?: {
    agentId?: string;
    filter?: Record<string, unknown>;
  }): Promise<T>;
}

export function getMethodDefinition(proto: object, methodName: string) {
  const methodMetadata = getReflectMetadata<BlueMethodMetadata>(
    BLUE_METHOD_KEY,
    proto,
    methodName
  );

  if (!methodMetadata) return null;

  const parametersTSMetadata =
    getReflectMetadata<TSBlueMethodParameterMetadata[]>(
      TS_BLUE_METHOD_PARAMETERS_KEY,
      proto,
      methodName
    ) || [];

  const parametersMetadata =
    getReflectMetadata<BlueMethodParameterMetadata[]>(
      BLUE_METHOD_PARAMETERS_KEY,
      proto,
      methodName
    ) || [];

  const params = parametersMetadata.map((p) => {
    const extractedTSMetadata = parametersTSMetadata[p.index] || {
      name: `param${p.index}`,
      isOptional: false,
    };

    return {
      name: extractedTSMetadata.name,
      type: p.type,
      constraints: {
        required: !extractedTSMetadata.isOptional,
      },
    };
  });

  return {
    name: methodName,
    type: 'Method Definition',
    params,
    returns: {
      type: methodMetadata.returnType,
    },
  } satisfies MethodDefinition;
}

export const BlueAgentClientDecoratorName = 'BlueAgentClient';

export function BlueAgentClient(metadata: BlueAgentClientMetadata) {
  return function <TCtor extends abstract new (...args: never[]) => object>(
    ctor: TCtor
  ) {
    Reflect.defineMetadata(BLUE_AGENT_CLIENT_KEY, metadata, ctor);
    const proto = ctor.prototype;

    for (const propertyKey of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, propertyKey);
      if (descriptor && typeof descriptor.value === 'function') {
        const methodMetadata = getReflectMetadata<BlueMethodMetadata>(
          BLUE_METHOD_KEY,
          proto,
          propertyKey
        );

        if (methodMetadata) {
          descriptor.value = async function (
            this: BaseAgentClient,
            ...methodArgs: unknown[]
          ) {
            const sdk = AppSDK.getInstance();

            if (!sdk) {
              throw new Error(
                'SDK instance not found. Make sure it is passed to the constructor.'
              );
            }

            const methodDefinition = getMethodDefinition(proto, propertyKey);

            if (!methodDefinition) {
              throw new Error(
                `Method definition not found for method ${propertyKey}`
              );
            }

            const resultFromServer = await sdk.sendRequest({
              type: 'call-method',
              variables: {
                agentId: this.agentId,
                methodDefinition,
                params: methodArgs,
              },
            });

            return resultFromServer;
          };

          Object.defineProperty(proto, propertyKey, descriptor);
        }
      }
    }

    return ctor as TCtor & BlueAgentClientStatic<InstanceType<TCtor>>;
  };
}

export function Blue<T extends abstract new (...args: unknown[]) => object>(
  target: T
) {
  Reflect.defineMetadata(BLUE_MARKER_KEY, true, target);
}

export function BlueId(metadata: string) {
  return function <T extends { new (...args: unknown[]): object }>(target: T) {
    Reflect.defineMetadata(BLUE_ID_KEY, metadata, target);
    return target;
  };
}

type MethodDecoratorTarget = object;

export function BlueMethod(metadata: BlueMethodMetadata) {
  return function (
    target: MethodDecoratorTarget,
    propertyKey: string | symbol
  ) {
    Reflect.defineMetadata(BLUE_METHOD_KEY, metadata, target, propertyKey);
  };
}

export function BlueMethodParam(type: string) {
  return function (
    target: MethodDecoratorTarget,
    propertyKey: string | symbol,
    parameterIndex: number
  ) {
    const metadata =
      getReflectMetadata<BlueMethodParameterMetadata[]>(
        BLUE_METHOD_PARAMETERS_KEY,
        target,
        propertyKey
      ) || [];

    metadata.push({ index: parameterIndex, type });

    Reflect.defineMetadata(
      BLUE_METHOD_PARAMETERS_KEY,
      metadata,
      target,
      propertyKey
    );
  };
}
