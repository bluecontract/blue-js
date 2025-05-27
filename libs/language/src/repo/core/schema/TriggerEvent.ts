import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';
import { blueNodeField } from '../../../schema/annotations/blueNode';

export const TriggerEventSchema = withTypeBlueId(blueIds['Trigger Event'])(
  z.object({
    event: blueNodeField(),
  })
);

export type TriggerEvent = z.infer<typeof TriggerEventSchema>;
