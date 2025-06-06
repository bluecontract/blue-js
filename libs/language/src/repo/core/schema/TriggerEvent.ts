import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';
import { blueNodeField } from '@blue-company/schema-annotations';

export const TriggerEventSchema = withTypeBlueId(blueIds['Trigger Event'])(
  z.object({
    event: blueNodeField(),
  })
);

export type TriggerEvent = z.infer<typeof TriggerEventSchema>;
