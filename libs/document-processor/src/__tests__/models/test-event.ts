import { z } from 'zod';
import { withTypeBlueId } from '@blue-labs/language';

export const testEventSchema = withTypeBlueId('TestEvent')(
  z.object({
    eventId: z.string().optional(),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    kind: z.string().optional(),
  }),
);

export type TestEvent = z.infer<typeof testEventSchema>;
