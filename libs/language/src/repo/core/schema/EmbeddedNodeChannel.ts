import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';
import { ChannelSchema } from './Channel';

export const EmbeddedNodeChannelSchema = withTypeBlueId(
  blueIds['Embedded Node Channel']
)(
  ChannelSchema.extend({
    path: z.string().optional(),
  })
);

export type EmbeddedNodeChannel = z.infer<typeof EmbeddedNodeChannelSchema>;
