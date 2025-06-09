import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';

export const TriggerEventSchema = withTypeBlueId(blueIds['Trigger Event'])(
  z.object({
    event: blueNodeField(),
  })
);

export type TriggerEvent = z.infer<typeof TriggerEventSchema>;
