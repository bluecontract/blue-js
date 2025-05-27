import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '../../../schema/annotations/typeBlueId';

export const ChannelSchema = withTypeBlueId(blueIds.Channel)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  })
);

export type Channel = z.infer<typeof ChannelSchema>;
