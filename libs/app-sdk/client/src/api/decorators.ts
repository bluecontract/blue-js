import 'reflect-metadata';
import { AppSDK } from 'src/sdk';

const BLUE_ID_KEY = Symbol('blueId');
const BLUE_MARKER_KEY = Symbol('blueMarker');

const BLUE_METHOD_KEY = Symbol('BlueMethod');
type BlueMethodMetadata = {
  returnType: string;
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

export function BlueMethodApiClient<
  T extends abstract new (...args: never[]) => object
>(target: T) {
  const proto = target.prototype;

  for (const propertyKey of Object.getOwnPropertyNames(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, propertyKey);
    if (descriptor && typeof descriptor.value === 'function') {
      const methodMetadata = getReflectMetadata<BlueMethodMetadata>(
        BLUE_METHOD_KEY,
        proto,
        propertyKey
      );

      if (methodMetadata) {
        descriptor.value = async function (...methodArgs: unknown[]) {
          // TODO: Make it work with classes that have optional sdk property
          const sdk = (this as { sdk?: AppSDK }).sdk;

          if (!sdk) {
            throw new Error(
              'SDK instance not found. Make sure it is passed to the constructor.'
            );
          }

          const className =
            (Reflect.getOwnMetadata(
              TS_BLUE_METHOD_API_CLIENT_CLASS_NAME_KEY,
              this.constructor
            ) as string | undefined) ?? this.constructor.name;

          const parametersTSMetadata =
            getReflectMetadata<TSBlueMethodParameterMetadata[]>(
              TS_BLUE_METHOD_PARAMETERS_KEY,
              proto,
              propertyKey
            ) || [];

          const parametersMetadata =
            getReflectMetadata<BlueMethodParameterMetadata[]>(
              BLUE_METHOD_PARAMETERS_KEY,
              proto,
              propertyKey
            ) || [];

          const params = parametersMetadata.reduce((acc, p) => {
            const extractedTSMetadata =
              parametersTSMetadata[p.index] || `param${p.index}`;

            acc[extractedTSMetadata.name] = {
              type: p.type,
              constraints: {
                required: !extractedTSMetadata.isOptional,
              },
              value: methodArgs[p.index],
            };

            return acc;
          }, {} as Record<string, unknown>);

          const methodDefinition = {
            name: propertyKey,
            type: 'Method Definition',
            objectType: className,
            params,
            returns: {
              type: methodMetadata.returnType,
            },
          };

          const resultFromServer = await sdk.api.callAPI({
            type: 'call-method',
            variables: {
              methodDefinition,
            },
          });

          return resultFromServer;
        };

        Object.defineProperty(proto, propertyKey, descriptor);
      }
    }
  }
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
