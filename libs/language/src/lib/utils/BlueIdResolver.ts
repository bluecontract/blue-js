import { ZodTypeAny } from 'zod';
import { getTypeBlueIdAnnotation } from '../../schema/annotations';
import { isNonNullable, isNullable } from '@blue-company/shared-utils';

type TypeBlueIdAnnotation = ReturnType<typeof getTypeBlueIdAnnotation>;

export class BlueIdResolver {
  static resolveBlueId(schema: ZodTypeAny) {
    const typeBlueIdAnnotation = getTypeBlueIdAnnotation(schema);
    if (isNullable(typeBlueIdAnnotation)) {
      return null;
    }

    const defaultValue = typeBlueIdAnnotation.defaultValue;
    if (isNonNullable(defaultValue)) {
      return defaultValue;
    }

    const value = typeBlueIdAnnotation.value?.[0];
    if (isNonNullable(value)) {
      return value;
    }

    return BlueIdResolver.getRepositoryBlueId(typeBlueIdAnnotation, schema);
  }

  static getRepositoryBlueId(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    annotation: TypeBlueIdAnnotation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schema: ZodTypeAny
  ) {
    throw new Error('Not implemented');
    return null;
  }
}
