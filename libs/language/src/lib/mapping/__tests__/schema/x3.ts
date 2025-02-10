import z from 'zod';
import { xSchema } from './x';
import { withTypeBlueId } from '../../../../schema/annotations';

/**
 * In the JAVA version, X3 is a class with concurrent fields.
 * This is a simplified ZOD version of the same type since these specific implementations don't exist in TypeScript.
 */
export const x3Schema = withTypeBlueId('X3-BlueId')(
  xSchema.extend({
    atomicIntegerField: z.number().optional(),
    atomicLongField: z.number().optional(),
    concurrentMapField: z.map(z.string(), z.number()).optional(),
  })
);
