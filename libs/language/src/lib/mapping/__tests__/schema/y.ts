import { z } from 'zod';
import { xSchema } from './x';
import { x1Schema } from './x1';
import { x2Schema } from './x2';
import { xSubscriptionSchema } from './xSubscription';
import { withTypeBlueId } from '../../annotations';

export const ySchema = withTypeBlueId('Y-BlueId')(
  z.object({
    xField: xSchema.optional(),
    x1Field: x1Schema.optional(),
    x2Field: x2Schema.optional(),

    xListField: z.array(xSchema).optional(),
    xMapField: z.map(z.string(), xSchema).optional(),
    x1SetField: z.set(x1Schema).optional(),
    x2MapField: z.map(z.string(), x2Schema).optional(),
    xArrayField: z.array(xSchema).optional(),

    wildcardXListField: z.array(xSchema).optional(),
    subscriptions: z.array(xSubscriptionSchema).optional(),
  })
);
