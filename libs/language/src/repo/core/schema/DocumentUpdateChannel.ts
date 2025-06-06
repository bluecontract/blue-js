import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId } from '@blue-company/schema-annotations';
import { ChannelSchema } from './Channel';

export const DocumentUpdateChannelSchema = withTypeBlueId(
  blueIds['Document Update Channel']
)(
  ChannelSchema.extend({
    path: z.string().optional(),
  })
);

export type DocumentUpdateChannel = z.infer<typeof DocumentUpdateChannelSchema>;
