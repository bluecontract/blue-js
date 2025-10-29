import { z } from 'zod';
import { withTypeBlueId } from '../../../../schema/annotations';

export enum TestEnum {
  SOME_ENUM_VALUE = 'SOME_ENUM_VALUE',
  ANOTHER_ENUM_VALUE = 'ANOTHER_ENUM_VALUE',
}

export const xSchema = withTypeBlueId('X-BlueId')(
  z.object({
    type: z.string().optional(),
    // Using number for byte/short/int/long but could add custom validation
    byteField: z.number().min(-128).max(127).optional(),
    byteObjectField: z.number().min(-128).max(127).nullable().optional(),
    shortField: z.number().min(-32768).max(32767).optional(),
    shortObjectField: z.number().min(-32768).max(32767).nullable().optional(),
    intField: z.number().int().optional(),
    integerField: z.number().int().nullable().optional(),
    longField: z.number().optional(),
    longObjectField: z.number().nullable().optional(),
    floatField: z.number().optional(),
    floatObjectField: z.number().nullable().optional(),
    doubleField: z.number().optional(),
    doubleObjectField: z.number().nullable().optional(),
    booleanField: z.boolean().optional(),
    booleanObjectField: z.boolean().nullable().optional(),
    charField: z.string().length(1).optional(),
    characterField: z.string().length(1).nullable().optional(),
    stringField: z.string().optional(),
    // For BigInteger/BigDecimal we'll use string representation
    // bigIntegerField: z.string().optional(),
    // bigDecimalField: z.string().optional(),
    enumField: z.nativeEnum(TestEnum).optional(),
  }),
);
