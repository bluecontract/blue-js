import { z } from 'zod';

export const xSubscriptionSchema = z.object({
  subscriptionId: z.number().optional(),
});

export type XSubscription = z.infer<typeof xSubscriptionSchema>;
