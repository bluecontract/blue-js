import 'reflect-metadata';

type GetReflectPropertyMetadataProps = {
  metadataKey: unknown;
  target: object;
  propertyKey: string | symbol;
  useOwnMetadata?: boolean;
};

type GetReflectMetadataProps = Omit<
  GetReflectPropertyMetadataProps,
  'propertyKey'
>;

export const getReflectPropertyMetadata = <T>({
  metadataKey,
  target,
  propertyKey,
  useOwnMetadata = false,
}: GetReflectPropertyMetadataProps) => {
  return (useOwnMetadata ? Reflect.getOwnMetadata : Reflect.getMetadata)(
    metadataKey,
    target,
    propertyKey
  ) as T | undefined;
};

export const getReflectMetadata = <T>({
  metadataKey,
  target,
  useOwnMetadata = false,
}: GetReflectMetadataProps) => {
  return (useOwnMetadata ? Reflect.getOwnMetadata : Reflect.getMetadata)(
    metadataKey,
    target
  ) as T | undefined;
};
