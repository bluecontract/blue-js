import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';

export const TriggerEventSchema = withTypeBlueId(blueIds['Trigger Event'])(
  z.object({
    event: z.any(),
  })
);

export type TriggerEvent = z.infer<typeof TriggerEventSchema>;
