import { z } from 'zod';
import { blueIds } from '../blue-ids';
import { withTypeBlueId, blueNodeField } from '@blue-labs/language';
import { ChannelSchema } from '../../core';
import { MyOSAgentSchema } from './MyOSAgent';

export const MyOSAgentChannelSchema = withTypeBlueId(
  blueIds['MyOS Agent Channel']
)(
  ChannelSchema.extend({
    agent: MyOSAgentSchema.optional(),
    event: blueNodeField().optional(),
  })
);

export type MyOSAgentChannel = z.infer<typeof MyOSAgentChannelSchema>;
